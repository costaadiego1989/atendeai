import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { resolveDateRange } from './date-range.util';

export interface SocialMetricsResult {
  period: { start: Date; end: Date };
  totalAccounts: number;
  accountsByStatus: Record<string, number>;
  accountsByPlatform: Record<string, number>;
  commentsReceived: number;
  commentsBySentiment: Record<string, number>;
  commentsByStatus: Record<string, number>;
  topTenantsByComments: Array<{
    tenantId: string;
    companyName: string;
    count: number;
  }>;
}

@Injectable()
export class PlatformSocialReadDao {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(input: {
    period?: '1d' | '7d' | '30d' | '90d' | 'custom';
    startDate?: string;
    endDate?: string;
    tenantId?: string;
  }): Promise<SocialMetricsResult> {
    const { start, end } = resolveDateRange(input);
    const tenantFilter = input.tenantId ? { tenantId: input.tenantId } : {};

    const [
      totalAccounts,
      statusGroups,
      platformGroups,
      commentsReceived,
      sentimentGroups,
      commentStatusGroups,
      topTenants,
    ] = await Promise.all([
      this.prisma.socialAccount.count({ where: tenantFilter }),
      this.prisma.socialAccount.groupBy({
        by: ['status'],
        where: tenantFilter,
        _count: true,
      }),
      this.prisma.socialAccount.groupBy({
        by: ['platform'],
        where: tenantFilter,
        _count: true,
      }),
      this.prisma.socialComment.count({
        where: { ...tenantFilter, receivedAt: { gte: start, lte: end } },
      }),
      this.prisma.socialComment.groupBy({
        by: ['sentiment'],
        where: {
          ...tenantFilter,
          receivedAt: { gte: start, lte: end },
          sentiment: { not: null },
        },
        _count: true,
      }),
      this.prisma.socialComment.groupBy({
        by: ['status'],
        where: { ...tenantFilter, receivedAt: { gte: start, lte: end } },
        _count: true,
      }),
      this.prisma.socialComment.groupBy({
        by: ['tenantId'],
        where: { receivedAt: { gte: start, lte: end } },
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
      totalAccounts,
      accountsByStatus: Object.fromEntries(
        statusGroups.map((g) => [g.status, g._count]),
      ),
      accountsByPlatform: Object.fromEntries(
        platformGroups.map((g) => [g.platform, g._count]),
      ),
      commentsReceived,
      commentsBySentiment: Object.fromEntries(
        sentimentGroups.map((g) => [g.sentiment ?? 'UNKNOWN', g._count]),
      ),
      commentsByStatus: Object.fromEntries(
        commentStatusGroups.map((g) => [g.status, g._count]),
      ),
      topTenantsByComments: topTenants.map((t) => ({
        tenantId: t.tenantId,
        companyName: tenantMap.get(t.tenantId) ?? 'Unknown',
        count: t._count,
      })),
    };
  }
}
