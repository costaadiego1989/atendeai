import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { resolveDateRange } from './date-range.util';

export interface DashboardOverviewMetrics {
  period: { start: Date; end: Date };
  tenants: {
    totalActive: number;
    newInPeriod: number;
    inTrial: number;
    churned: number;
  };
  revenue: {
    mrr: number;
    arr: number;
    byPlan: Record<string, number>;
  };
  operations: {
    totalMessages: number;
    totalAiTokens: number;
    totalContacts: number;
    activeConversations: number;
  };
  sales: {
    totalRevenue: number;
    conversionRate: number;
  };
  support: {
    openTickets: number;
  };
}

@Injectable()
export class PlatformDashboardReadDao {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(input: {
    period?: '1d' | '7d' | '30d' | '90d' | 'custom';
    startDate?: string;
    endDate?: string;
    plan?: string;
    planStatus?: string;
  }): Promise<DashboardOverviewMetrics> {
    const { start, end } = resolveDateRange(input);

    const tenantWhere: Record<string, unknown> = {};
    if (input.plan) tenantWhere.plan = input.plan;
    if (input.planStatus) tenantWhere.planStatus = input.planStatus;

    const [
      totalActive,
      newInPeriod,
      inTrial,
      churned,
      subscriptions,
      usageAgg,
      activeConversations,
      salesAgg,
      openTickets,
    ] = await Promise.all([
      // Total active tenants
      this.prisma.tenant.count({
        where: { ...tenantWhere, planStatus: 'ACTIVE' },
      }),
      // New tenants in period
      this.prisma.tenant.count({
        where: {
          ...tenantWhere,
          createdAt: { gte: start, lte: end },
        },
      }),
      // Tenants in trial
      this.prisma.tenant.count({
        where: { ...tenantWhere, plan: 'TRIAL' },
      }),
      // Churned (cancelled subscriptions in period)
      this.prisma.subscription.count({
        where: {
          status: 'CANCELLED',
          createdAt: { gte: start, lte: end },
        },
      }),
      // All active subscriptions for MRR
      this.prisma.subscription.findMany({
        where: { status: 'ACTIVE' },
        select: { plan: true, totalMonthlyPrice: true },
      }),
      // Usage aggregation for period
      this.prisma.usageRecord.aggregate({
        where: {
          periodStart: { gte: start },
          periodEnd: { lte: end },
        },
        _sum: {
          messagesUsed: true,
          aiTokensUsed: true,
          contactsUsed: true,
        },
      }),
      // Active conversations right now
      this.prisma.conversation.count({
        where: { status: 'ACTIVE' },
      }),
      // Sales revenue in period
      this.prisma.salesMetric.aggregate({
        where: {
          date: { gte: start, lte: end },
        },
        _sum: {
          estimatedRevenue: true,
          purchaseIntents: true,
          paymentLinksGenerated: true,
        },
      }),
      // Open support tickets
      this.prisma.supportFeedback.count({
        where: { status: 'OPEN' },
      }),
    ]);

    // Calculate MRR and breakdown by plan
    let mrr = 0;
    const byPlan: Record<string, number> = {};
    for (const sub of subscriptions) {
      const price = Number(sub.totalMonthlyPrice);
      mrr += price;
      byPlan[sub.plan] = (byPlan[sub.plan] ?? 0) + price;
    }

    // Conversion rate: payment links generated vs purchase intents
    const intents = salesAgg._sum.purchaseIntents ?? 0;
    const links = salesAgg._sum.paymentLinksGenerated ?? 0;
    const conversionRate = intents > 0 ? links / intents : 0;

    return {
      period: { start, end },
      tenants: {
        totalActive,
        newInPeriod,
        inTrial,
        churned,
      },
      revenue: {
        mrr: Math.round(mrr * 100) / 100,
        arr: Math.round(mrr * 12 * 100) / 100,
        byPlan,
      },
      operations: {
        totalMessages: usageAgg._sum.messagesUsed ?? 0,
        totalAiTokens: usageAgg._sum.aiTokensUsed ?? 0,
        totalContacts: usageAgg._sum.contactsUsed ?? 0,
        activeConversations,
      },
      sales: {
        totalRevenue: Number(salesAgg._sum.estimatedRevenue ?? 0),
        conversionRate: Math.round(conversionRate * 10000) / 100,
      },
      support: {
        openTickets,
      },
    };
  }
}
