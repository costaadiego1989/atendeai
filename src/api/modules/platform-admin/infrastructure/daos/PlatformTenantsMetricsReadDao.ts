import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { resolveDateRange } from './date-range.util';

export interface TenantsMetricsResult {
  period: { start: Date; end: Date };
  growth: Array<{ date: string; count: number }>;
  distributionByPlan: Record<string, number>;
  distributionByBusinessType: Record<string, number>;
  tenantsAbove80Quota: number;
  inactiveTenantsNoMessage7d: number;
  tenantsWithoutWhatsApp: number;
  tenantsWithoutAI: number;
  topTenantsByMessages: Array<{
    tenantId: string;
    companyName: string;
    messagesUsed: number;
  }>;
  topTenantsByRevenue: Array<{
    tenantId: string;
    companyName: string;
    revenue: number;
  }>;
}

export interface TenantDetailResult {
  tenantId: string;
  companyName: string;
  cnpj: string;
  plan: string;
  planStatus: string;
  businessType: string | null;
  city: string | null;
  state: string | null;
  createdAt: Date;
  subscription: {
    plan: string;
    status: string;
    totalMonthlyPrice: number;
    billingCycleStart: Date;
    billingCycleEnd: Date;
  } | null;
  usage: {
    messagesUsed: number;
    aiTokensUsed: number;
    contactsUsed: number;
  } | null;
  stats: {
    totalContacts: number;
    totalConversations: number;
    activeConversations: number;
  };
  hasWhatsApp: boolean;
  hasAI: boolean;
}

@Injectable()
export class PlatformTenantsMetricsReadDao {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(input: {
    period?: '1d' | '7d' | '30d' | '90d' | 'custom';
    startDate?: string;
    endDate?: string;
  }): Promise<TenantsMetricsResult> {
    const { start, end } = resolveDateRange(input);

    const [
      growthData,
      planDistribution,
      businessTypeDistribution,
      allActiveSubs,
      latestUsage,
      inactiveConversations,
      tenantsWithoutWA,
      tenantsWithoutAI,
      topByMessages,
      topByRevenue,
    ] = await Promise.all([
      // Growth: tenants created per day in period
      this.prisma.tenant.groupBy({
        by: ['createdAt'],
        where: { createdAt: { gte: start, lte: end } },
        _count: true,
        orderBy: { createdAt: 'asc' },
      }),
      // Distribution by plan
      this.prisma.tenant.groupBy({
        by: ['plan'],
        where: { planStatus: 'ACTIVE' },
        _count: true,
      }),
      // Distribution by business type
      this.prisma.tenant.groupBy({
        by: ['businessType'],
        where: { planStatus: 'ACTIVE', businessType: { not: null } },
        _count: true,
      }),
      // Active subscriptions with quotas
      this.prisma.subscription.findMany({
        where: { status: 'ACTIVE' },
        select: { tenantId: true, messagesQuota: true },
      }),
      // Latest usage records
      this.prisma.usageRecord.findMany({
        orderBy: { updatedAt: 'desc' },
        distinct: ['tenantId'],
        select: { tenantId: true, messagesUsed: true },
      }),
      // Tenants with no conversation activity in 7 days
      this.prisma.tenant.count({
        where: {
          planStatus: 'ACTIVE',
          id: {
            notIn: (
              await this.prisma.conversation.findMany({
                where: {
                  lastMessageAt: {
                    gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                  },
                },
                distinct: ['tenantId'],
                select: { tenantId: true },
              })
            ).map((c) => c.tenantId),
          },
        },
      }),
      // Tenants without WhatsApp config
      this.prisma.tenant.count({
        where: {
          planStatus: 'ACTIVE',
          whatsappConfig: null,
        },
      }),
      // Tenants without AI config
      this.prisma.tenant.count({
        where: {
          planStatus: 'ACTIVE',
          aiConfig: null,
        },
      }),
      // Top tenants by messages
      this.prisma.usageRecord.groupBy({
        by: ['tenantId'],
        where: { periodStart: { gte: start } },
        _sum: { messagesUsed: true },
        orderBy: { _sum: { messagesUsed: 'desc' } },
        take: 10,
      }),
      // Top tenants by revenue (GMV)
      this.prisma.salesMetric.groupBy({
        by: ['tenantId'],
        where: { date: { gte: start, lte: end } },
        _sum: { estimatedRevenue: true },
        orderBy: { _sum: { estimatedRevenue: 'desc' } },
        take: 10,
      }),
    ]);

    // Resolve tenant names for top lists
    const allTopIds = [
      ...topByMessages.map((t) => t.tenantId),
      ...topByRevenue.map((t) => t.tenantId),
    ];
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: [...new Set(allTopIds)] } },
      select: { id: true, companyName: true },
    });
    const tenantMap = new Map(tenants.map((t) => [t.id, t.companyName]));

    // Calculate tenants above 80% quota
    const usageMap = new Map(latestUsage.map((u) => [u.tenantId, u.messagesUsed]));
    let tenantsAbove80Quota = 0;
    for (const sub of allActiveSubs) {
      const used = usageMap.get(sub.tenantId) ?? 0;
      if (sub.messagesQuota > 0 && used / sub.messagesQuota >= 0.8) {
        tenantsAbove80Quota++;
      }
    }

    // Aggregate growth by date (groupBy createdAt returns individual timestamps)
    const growthMap = new Map<string, number>();
    for (const g of growthData) {
      const dateKey = g.createdAt.toISOString().split('T')[0];
      growthMap.set(dateKey, (growthMap.get(dateKey) ?? 0) + g._count);
    }

    return {
      period: { start, end },
      growth: Array.from(growthMap.entries()).map(([date, count]) => ({
        date,
        count,
      })),
      distributionByPlan: Object.fromEntries(
        planDistribution.map((g) => [g.plan, g._count]),
      ),
      distributionByBusinessType: Object.fromEntries(
        businessTypeDistribution.map((g) => [g.businessType ?? 'OTHER', g._count]),
      ),
      tenantsAbove80Quota,
      inactiveTenantsNoMessage7d: inactiveConversations,
      tenantsWithoutWhatsApp: tenantsWithoutWA,
      tenantsWithoutAI: tenantsWithoutAI,
      topTenantsByMessages: topByMessages.map((t) => ({
        tenantId: t.tenantId,
        companyName: tenantMap.get(t.tenantId) ?? 'Unknown',
        messagesUsed: t._sum.messagesUsed ?? 0,
      })),
      topTenantsByRevenue: topByRevenue.map((t) => ({
        tenantId: t.tenantId,
        companyName: tenantMap.get(t.tenantId) ?? 'Unknown',
        revenue: Number(t._sum.estimatedRevenue ?? 0),
      })),
    };
  }

  async getTenantDetail(tenantId: string): Promise<TenantDetailResult | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        whatsappConfig: { select: { id: true } },
        aiConfig: { select: { id: true } },
      },
    });

    if (!tenant) return null;

    const [subscription, usage, contactCount, conversationCounts] =
      await Promise.all([
        this.prisma.subscription.findUnique({
          where: { tenantId },
        }),
        this.prisma.usageRecord.findFirst({
          where: { tenantId },
          orderBy: { updatedAt: 'desc' },
        }),
        this.prisma.contact.count({ where: { tenantId } }),
        this.prisma.conversation.groupBy({
          by: ['status'],
          where: { tenantId },
          _count: true,
        }),
      ]);

    const totalConversations = conversationCounts.reduce(
      (sum, g) => sum + g._count,
      0,
    );
    const activeConversations =
      conversationCounts.find((g) => g.status === 'ACTIVE')?._count ?? 0;

    return {
      tenantId: tenant.id,
      companyName: tenant.companyName,
      cnpj: tenant.cnpj,
      plan: tenant.plan,
      planStatus: tenant.planStatus,
      businessType: tenant.businessType,
      city: tenant.city,
      state: tenant.state,
      createdAt: tenant.createdAt,
      subscription: subscription
        ? {
            plan: subscription.plan,
            status: subscription.status,
            totalMonthlyPrice: Number(subscription.totalMonthlyPrice),
            billingCycleStart: subscription.billingCycleStart,
            billingCycleEnd: subscription.billingCycleEnd,
          }
        : null,
      usage: usage
        ? {
            messagesUsed: usage.messagesUsed,
            aiTokensUsed: usage.aiTokensUsed,
            contactsUsed: usage.contactsUsed,
          }
        : null,
      stats: {
        totalContacts: contactCount,
        totalConversations,
        activeConversations,
      },
      hasWhatsApp: !!tenant.whatsappConfig,
      hasAI: !!tenant.aiConfig,
    };
  }
}
