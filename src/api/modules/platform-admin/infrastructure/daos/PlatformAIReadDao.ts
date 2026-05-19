import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { resolveDateRange } from './date-range.util';

export interface AIMetricsResult {
  period: { start: Date; end: Date };
  totalSessions: number;
  totalTokensConsumed: number;
  sessionsByIntent: Record<string, number>;
  sessionsBySentiment: Record<string, number>;
  averageConfidence: number;
  handoffRate: number;
  tenantsWithoutAIConfig: number;
  topTenantsByTokens: Array<{
    tenantId: string;
    companyName: string;
    tokens: number;
  }>;
}

export interface AISessionListItem {
  id: string;
  tenantId: string;
  companyName: string;
  conversationId: string | null;
  intent: string | null;
  sentiment: string | null;
  confidence: number | null;
  status: string;
  totalTokens: number;
  createdAt: Date;
}

@Injectable()
export class PlatformAIReadDao {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(input: {
    period?: '1d' | '7d' | '30d' | '90d' | 'custom';
    startDate?: string;
    endDate?: string;
    tenantId?: string;
  }): Promise<AIMetricsResult> {
    const { start, end } = resolveDateRange(input);
    const tenantFilter = input.tenantId ? { tenantId: input.tenantId } : {};
    const periodFilter = { createdAt: { gte: start, lte: end } };

    const [
      totalSessions,
      tokensAgg,
      intentGroups,
      sentimentGroups,
      confidenceAgg,
      lowConfidenceSessions,
      tenantsWithoutAI,
      topTenants,
    ] = await Promise.all([
      this.prisma.aISession.count({
        where: { ...tenantFilter, ...periodFilter },
      }),
      this.prisma.aISession.aggregate({
        where: { ...tenantFilter, ...periodFilter },
        _sum: { totalTokens: true },
      }),
      this.prisma.aISession.groupBy({
        by: ['intent'],
        where: { ...tenantFilter, ...periodFilter, intent: { not: null } },
        _count: true,
      }),
      this.prisma.aISession.groupBy({
        by: ['sentiment'],
        where: { ...tenantFilter, ...periodFilter, sentiment: { not: null } },
        _count: true,
      }),
      this.prisma.aISession.aggregate({
        where: {
          ...tenantFilter,
          ...periodFilter,
          confidence: { not: null },
        },
        _avg: { confidence: true },
      }),
      // Low confidence sessions (handoff candidates)
      this.prisma.aISession.count({
        where: {
          ...tenantFilter,
          ...periodFilter,
          confidence: { lt: 0.7 },
        },
      }),
      // Tenants without AI config
      this.prisma.tenant.count({
        where: { planStatus: 'ACTIVE', aiConfig: null },
      }),
      // Top tenants by token consumption
      this.prisma.aISession.groupBy({
        by: ['tenantId'],
        where: periodFilter,
        _sum: { totalTokens: true },
        orderBy: { _sum: { totalTokens: 'desc' } },
        take: 10,
      }),
    ]);

    const tenantIds = topTenants.map((t) => t.tenantId);
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, companyName: true },
    });
    const tenantMap = new Map(tenants.map((t) => [t.id, t.companyName]));

    const handoffRate =
      totalSessions > 0
        ? Math.round((lowConfidenceSessions / totalSessions) * 10000) / 100
        : 0;

    return {
      period: { start, end },
      totalSessions,
      totalTokensConsumed: tokensAgg._sum.totalTokens ?? 0,
      sessionsByIntent: Object.fromEntries(
        intentGroups.map((g) => [g.intent ?? 'UNKNOWN', g._count]),
      ),
      sessionsBySentiment: Object.fromEntries(
        sentimentGroups.map((g) => [g.sentiment ?? 'UNKNOWN', g._count]),
      ),
      averageConfidence: Number(confidenceAgg._avg.confidence ?? 0),
      handoffRate,
      tenantsWithoutAIConfig: tenantsWithoutAI,
      topTenantsByTokens: topTenants.map((t) => ({
        tenantId: t.tenantId,
        companyName: tenantMap.get(t.tenantId) ?? 'Unknown',
        tokens: t._sum.totalTokens ?? 0,
      })),
    };
  }

  async listSessions(input: {
    page: number;
    limit: number;
    tenantId?: string;
    intent?: string;
    sentiment?: string;
  }): Promise<{ items: AISessionListItem[]; total: number }> {
    const skip = (input.page - 1) * input.limit;
    const where: Record<string, unknown> = {};
    if (input.tenantId) where.tenantId = input.tenantId;
    if (input.intent) where.intent = input.intent;
    if (input.sentiment) where.sentiment = input.sentiment;

    const [sessions, total] = await Promise.all([
      this.prisma.aISession.findMany({
        where,
        skip,
        take: input.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.aISession.count({ where }),
    ]);

    const tenantIds = [...new Set(sessions.map((s) => s.tenantId))];
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, companyName: true },
    });
    const tenantMap = new Map(tenants.map((t) => [t.id, t.companyName]));

    const items: AISessionListItem[] = sessions.map((s) => ({
      id: s.id,
      tenantId: s.tenantId,
      companyName: tenantMap.get(s.tenantId) ?? 'Unknown',
      conversationId: s.conversationId,
      intent: s.intent,
      sentiment: s.sentiment,
      confidence: s.confidence ? Number(s.confidence) : null,
      status: s.status,
      totalTokens: s.totalTokens,
      createdAt: s.createdAt,
    }));

    return { items, total };
  }
}
