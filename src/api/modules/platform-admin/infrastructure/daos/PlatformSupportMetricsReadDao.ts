import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { resolveDateRange } from './date-range.util';

export interface SupportMetricsResult {
  period: { start: Date; end: Date };
  totalOpen: number;
  feedbacksByType: Record<string, number>;
  feedbacksByStatus: Record<string, number>;
  feedbacksByModule: Record<string, number>;
  averageRating: number | null;
  topTenantsByFeedbacks: Array<{
    tenantId: string;
    companyName: string;
    count: number;
  }>;
}

@Injectable()
export class PlatformSupportMetricsReadDao {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(input: {
    period?: '1d' | '7d' | '30d' | '90d' | 'custom';
    startDate?: string;
    endDate?: string;
    tenantId?: string;
  }): Promise<SupportMetricsResult> {
    const { start, end } = resolveDateRange(input);
    const tenantFilter = input.tenantId ? { tenantId: input.tenantId } : {};

    const [
      totalOpen,
      typeGroups,
      statusGroups,
      moduleGroups,
      ratingAgg,
      topTenants,
    ] = await Promise.all([
      this.prisma.supportFeedback.count({
        where: { ...tenantFilter, status: 'OPEN' },
      }),
      this.prisma.supportFeedback.groupBy({
        by: ['type'],
        where: { ...tenantFilter, createdAt: { gte: start, lte: end } },
        _count: true,
      }),
      this.prisma.supportFeedback.groupBy({
        by: ['status'],
        where: { ...tenantFilter, createdAt: { gte: start, lte: end } },
        _count: true,
      }),
      this.prisma.supportFeedback.groupBy({
        by: ['appModule'],
        where: {
          ...tenantFilter,
          createdAt: { gte: start, lte: end },
          appModule: { not: null },
        },
        _count: true,
      }),
      this.prisma.supportFeedback.aggregate({
        where: {
          ...tenantFilter,
          createdAt: { gte: start, lte: end },
          rating: { not: null },
        },
        _avg: { rating: true },
      }),
      this.prisma.supportFeedback.groupBy({
        by: ['tenantId'],
        where: { createdAt: { gte: start, lte: end } },
        _count: true,
        orderBy: { _count: { tenantId: 'desc' } },
        take: 10,
      }),
    ]);

    const tenantIds = topTenants.map((t) => t.tenantId);
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, companyName: true },
    });
    const tenantMap = new Map(tenants.map((t) => [t.id, t.companyName]));

    return {
      period: { start, end },
      totalOpen,
      feedbacksByType: Object.fromEntries(
        typeGroups.map((g) => [g.type, g._count]),
      ),
      feedbacksByStatus: Object.fromEntries(
        statusGroups.map((g) => [g.status, g._count]),
      ),
      feedbacksByModule: Object.fromEntries(
        moduleGroups.map((g) => [g.appModule ?? 'UNKNOWN', g._count]),
      ),
      averageRating: ratingAgg._avg.rating ?? null,
      topTenantsByFeedbacks: topTenants.map((t) => ({
        tenantId: t.tenantId,
        companyName: tenantMap.get(t.tenantId) ?? 'Unknown',
        count: t._count,
      })),
    };
  }
}
