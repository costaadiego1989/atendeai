import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { resolveDateRange } from './date-range.util';

export interface ProposalMetricsResult {
  period: { start: Date; end: Date };
  totalCreated: number;
  proposalsByStatus: Record<string, number>;
  totalValueActive: number;
  conversionRate: number;
  averageValue: number;
  topTenantsByProposals: Array<{
    tenantId: string;
    companyName: string;
    count: number;
  }>;
}

@Injectable()
export class PlatformProposalReadDao {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(input: {
    period?: '1d' | '7d' | '30d' | '90d' | 'custom';
    startDate?: string;
    endDate?: string;
    tenantId?: string;
  }): Promise<ProposalMetricsResult> {
    const { start, end } = resolveDateRange(input);
    const tenantFilter = input.tenantId ? { tenantId: input.tenantId } : {};

    const [
      totalCreated,
      statusGroups,
      activeValueAgg,
      sentCount,
      acceptedCount,
      topTenants,
    ] = await Promise.all([
      this.prisma.proposal.count({
        where: { ...tenantFilter, createdAt: { gte: start, lte: end } },
      }),
      this.prisma.proposal.groupBy({
        by: ['status'],
        where: { ...tenantFilter, createdAt: { gte: start, lte: end } },
        _count: true,
      }),
      this.prisma.proposal.aggregate({
        where: {
          ...tenantFilter,
          status: { in: ['DRAFT', 'SENT'] },
        },
        _sum: { totalAmount: true },
        _avg: { totalAmount: true },
      }),
      this.prisma.proposal.count({
        where: {
          ...tenantFilter,
          createdAt: { gte: start, lte: end },
          status: { in: ['SENT', 'ACCEPTED', 'REJECTED'] },
        },
      }),
      this.prisma.proposal.count({
        where: {
          ...tenantFilter,
          createdAt: { gte: start, lte: end },
          status: 'ACCEPTED',
        },
      }),
      this.prisma.proposal.groupBy({
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

    const conversionRate =
      sentCount > 0 ? Math.round((acceptedCount / sentCount) * 10000) / 100 : 0;

    return {
      period: { start, end },
      totalCreated,
      proposalsByStatus: Object.fromEntries(
        statusGroups.map((g) => [g.status, g._count]),
      ),
      totalValueActive: Number(activeValueAgg._sum.totalAmount ?? 0),
      conversionRate,
      averageValue: Number(activeValueAgg._avg.totalAmount ?? 0),
      topTenantsByProposals: topTenants.map((t) => ({
        tenantId: t.tenantId,
        companyName: tenantMap.get(t.tenantId) ?? 'Unknown',
        count: t._count,
      })),
    };
  }
}
