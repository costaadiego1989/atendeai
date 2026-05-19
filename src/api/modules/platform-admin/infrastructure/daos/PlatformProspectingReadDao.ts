import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { resolveDateRange } from './date-range.util';

export interface ProspectingMetricsResult {
  period: { start: Date; end: Date };
  activeCampaigns: number;
  campaignsByStatus: Record<string, number>;
  totalExecutions: number;
  executionsByStatus: Record<string, number>;
  stopRate: number;
  leadsCaptures: number;
  leadsImported: number;
  searchResults: number;
  googleAdsConnections: number;
  topTenantsByExecutions: Array<{
    tenantId: string;
    companyName: string;
    count: number;
  }>;
}

export interface CampaignListItem {
  id: string;
  tenantId: string;
  companyName: string;
  name: string;
  objective: string;
  audienceType: string;
  channel: string;
  status: string;
  dailyLimit: number;
  blockRateThreshold: number;
  createdAt: Date;
}

@Injectable()
export class PlatformProspectingReadDao {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(input: {
    period?: '1d' | '7d' | '30d' | '90d' | 'custom';
    startDate?: string;
    endDate?: string;
    tenantId?: string;
  }): Promise<ProspectingMetricsResult> {
    const { start, end } = resolveDateRange(input);
    const tenantFilter = input.tenantId ? { tenantId: input.tenantId } : {};

    const [
      activeCampaigns,
      campaignStatusGroups,
      executionStatusGroups,
      stoppedExecutions,
      totalExecutionsInPeriod,
      leadsCaptures,
      leadsImported,
      searchResults,
      googleAdsConnections,
      topTenants,
    ] = await Promise.all([
      this.prisma.prospectCampaign.count({
        where: { ...tenantFilter, status: 'ACTIVE' },
      }),
      this.prisma.prospectCampaign.groupBy({
        by: ['status'],
        where: tenantFilter,
        _count: true,
      }),
      this.prisma.prospectExecution.groupBy({
        by: ['status'],
        where: {
          ...tenantFilter,
          createdAt: { gte: start, lte: end },
        },
        _count: true,
      }),
      this.prisma.prospectExecution.count({
        where: {
          ...tenantFilter,
          createdAt: { gte: start, lte: end },
          stopReason: { not: null },
        },
      }),
      this.prisma.prospectExecution.count({
        where: {
          ...tenantFilter,
          createdAt: { gte: start, lte: end },
        },
      }),
      this.prisma.prospectLeadCapture.count({
        where: {
          ...tenantFilter,
          createdAt: { gte: start, lte: end },
        },
      }),
      this.prisma.prospectLeadCapture.count({
        where: {
          ...tenantFilter,
          createdAt: { gte: start, lte: end },
          importStatus: 'IMPORTED',
        },
      }),
      this.prisma.prospectSearchResult.count({
        where: {
          ...tenantFilter,
          createdAt: { gte: start, lte: end },
        },
      }),
      this.prisma.googleAdsConnection.count({
        where: { status: 'ACTIVE' },
      }),
      this.prisma.prospectExecution.groupBy({
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

    const stopRate =
      totalExecutionsInPeriod > 0
        ? Math.round((stoppedExecutions / totalExecutionsInPeriod) * 10000) /
          100
        : 0;

    return {
      period: { start, end },
      activeCampaigns,
      campaignsByStatus: Object.fromEntries(
        campaignStatusGroups.map((g) => [g.status, g._count]),
      ),
      totalExecutions: totalExecutionsInPeriod,
      executionsByStatus: Object.fromEntries(
        executionStatusGroups.map((g) => [g.status, g._count]),
      ),
      stopRate,
      leadsCaptures,
      leadsImported,
      searchResults,
      googleAdsConnections,
      topTenantsByExecutions: topTenants.map((t) => ({
        tenantId: t.tenantId,
        companyName: tenantMap.get(t.tenantId) ?? 'Unknown',
        count: t._count,
      })),
    };
  }

  async listCampaigns(input: {
    page: number;
    limit: number;
    tenantId?: string;
    status?: string;
  }): Promise<{ items: CampaignListItem[]; total: number }> {
    const skip = (input.page - 1) * input.limit;
    const where: Record<string, unknown> = {};
    if (input.tenantId) where.tenantId = input.tenantId;
    if (input.status) where.status = input.status;

    const [campaigns, total] = await Promise.all([
      this.prisma.prospectCampaign.findMany({
        where,
        skip,
        take: input.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.prospectCampaign.count({ where }),
    ]);

    const tenantIds = [...new Set(campaigns.map((c) => c.tenantId))];
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, companyName: true },
    });
    const tenantMap = new Map(tenants.map((t) => [t.id, t.companyName]));

    const items: CampaignListItem[] = campaigns.map((c) => ({
      id: c.id,
      tenantId: c.tenantId,
      companyName: tenantMap.get(c.tenantId) ?? 'Unknown',
      name: c.name,
      objective: c.objective,
      audienceType: c.audienceType,
      channel: c.channel,
      status: c.status,
      dailyLimit: c.dailyLimit,
      blockRateThreshold: c.blockRateThreshold,
      createdAt: c.createdAt,
    }));

    return { items, total };
  }
}
