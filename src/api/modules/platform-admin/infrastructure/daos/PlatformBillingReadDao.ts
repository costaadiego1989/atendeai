import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { resolveDateRange } from './date-range.util';

export interface BillingMetricsResult {
  period: { start: Date; end: Date };
  mrr: number;
  arr: number;
  arpu: number;
  mrrByPlan: Record<string, number>;
  tenantsByPlan: Record<string, number>;
  churnRate: number;
  upgrades: number;
  downgrades: number;
  cancellations: number;
  totalMessagesUsed: number;
  totalMessagesQuota: number;
  totalAiTokensUsed: number;
  totalAiTokensQuota: number;
  tenantsAbove90Quota: number;
  addonsRevenue: number;
}

export interface SubscriptionListItem {
  tenantId: string;
  companyName: string;
  plan: string;
  status: string;
  totalMonthlyPrice: number;
  baseMonthlyPrice: number;
  addonsMonthlyPrice: number;
  billingCycleType: string;
  billingCycleStart: Date;
  billingCycleEnd: Date;
  createdAt: Date;
}

export interface UsageListItem {
  tenantId: string;
  companyName: string;
  messagesUsed: number;
  messagesQuota: number;
  aiTokensUsed: number;
  aiTokensQuota: number;
  contactsUsed: number;
  contactsQuota: number;
  periodStart: Date;
  periodEnd: Date;
}

@Injectable()
export class PlatformBillingReadDao {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(input: {
    period?: '1d' | '7d' | '30d' | '90d' | 'custom';
    startDate?: string;
    endDate?: string;
  }): Promise<BillingMetricsResult> {
    const { start, end } = resolveDateRange(input);

    const [activeSubscriptions, auditLogs, usageRecords] = await Promise.all([
      this.prisma.subscription.findMany({
        where: { status: 'ACTIVE' },
        select: {
          tenantId: true,
          plan: true,
          totalMonthlyPrice: true,
          baseMonthlyPrice: true,
          addonsMonthlyPrice: true,
          messagesQuota: true,
          aiTokensQuota: true,
        },
      }),
      this.prisma.billingAuditLog.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: { event: true, oldPlan: true, newPlan: true },
      }),
      this.prisma.usageRecord.findMany({
        where: {
          periodStart: { gte: start },
          periodEnd: { lte: end },
        },
        orderBy: { updatedAt: 'desc' },
        select: {
          tenantId: true,
          messagesUsed: true,
          aiTokensUsed: true,
        },
      }),
    ]);

    // MRR calculation
    let mrr = 0;
    let addonsRevenue = 0;
    const mrrByPlan: Record<string, number> = {};
    const tenantsByPlan: Record<string, number> = {};

    for (const sub of activeSubscriptions) {
      const price = Number(sub.totalMonthlyPrice);
      mrr += price;
      addonsRevenue += Number(sub.addonsMonthlyPrice);
      mrrByPlan[sub.plan] = (mrrByPlan[sub.plan] ?? 0) + price;
      tenantsByPlan[sub.plan] = (tenantsByPlan[sub.plan] ?? 0) + 1;
    }

    const activeCount = activeSubscriptions.length;
    const arpu = activeCount > 0 ? mrr / activeCount : 0;

    // Audit log analysis
    let upgrades = 0;
    let downgrades = 0;
    let cancellations = 0;
    const planOrder = ['TRIAL', 'STARTER', 'PRO', 'ENTERPRISE'];

    for (const log of auditLogs) {
      if (log.event === 'SUBSCRIPTION_CANCELLED') {
        cancellations++;
      } else if (log.event === 'PLAN_CHANGED' && log.oldPlan && log.newPlan) {
        const oldIdx = planOrder.indexOf(log.oldPlan);
        const newIdx = planOrder.indexOf(log.newPlan);
        if (newIdx > oldIdx) upgrades++;
        else if (newIdx < oldIdx) downgrades++;
      }
    }

    // Churn rate
    const totalSubs = await this.prisma.subscription.count();
    const churnRate =
      totalSubs > 0 ? Math.round((cancellations / totalSubs) * 10000) / 100 : 0;

    // Quota usage
    let totalMessagesUsed = 0;
    let totalAiTokensUsed = 0;
    const latestUsageByTenant = new Map<string, (typeof usageRecords)[number]>();
    for (const u of usageRecords) {
      if (!latestUsageByTenant.has(u.tenantId)) {
        latestUsageByTenant.set(u.tenantId, u);
      }
      totalMessagesUsed += u.messagesUsed;
      totalAiTokensUsed += u.aiTokensUsed;
    }

    let totalMessagesQuota = 0;
    let totalAiTokensQuota = 0;
    let tenantsAbove90Quota = 0;

    for (const sub of activeSubscriptions) {
      totalMessagesQuota += sub.messagesQuota;
      totalAiTokensQuota += sub.aiTokensQuota;
      const usage = latestUsageByTenant.get(sub.tenantId);
      if (usage && sub.messagesQuota > 0) {
        const ratio = usage.messagesUsed / sub.messagesQuota;
        if (ratio >= 0.9) tenantsAbove90Quota++;
      }
    }

    return {
      period: { start, end },
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(mrr * 12 * 100) / 100,
      arpu: Math.round(arpu * 100) / 100,
      mrrByPlan,
      tenantsByPlan,
      churnRate,
      upgrades,
      downgrades,
      cancellations,
      totalMessagesUsed,
      totalMessagesQuota,
      totalAiTokensUsed,
      totalAiTokensQuota,
      tenantsAbove90Quota,
      addonsRevenue: Math.round(addonsRevenue * 100) / 100,
    };
  }

  async listSubscriptions(input: {
    page: number;
    limit: number;
    subscriptionStatus?: string;
    billingCycleType?: string;
    plan?: string;
  }): Promise<{ items: SubscriptionListItem[]; total: number }> {
    const skip = (input.page - 1) * input.limit;
    const where: Record<string, unknown> = {};
    if (input.subscriptionStatus) where.status = input.subscriptionStatus;
    if (input.billingCycleType) where.billingCycleType = input.billingCycleType;
    if (input.plan) where.plan = input.plan;

    const [subscriptions, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        skip,
        take: input.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.subscription.count({ where }),
    ]);

    const tenantIds = subscriptions.map((s) => s.tenantId);
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, companyName: true },
    });
    const tenantMap = new Map(tenants.map((t) => [t.id, t.companyName]));

    const items: SubscriptionListItem[] = subscriptions.map((s) => ({
      tenantId: s.tenantId,
      companyName: tenantMap.get(s.tenantId) ?? 'Unknown',
      plan: s.plan,
      status: s.status,
      totalMonthlyPrice: Number(s.totalMonthlyPrice),
      baseMonthlyPrice: Number(s.baseMonthlyPrice),
      addonsMonthlyPrice: Number(s.addonsMonthlyPrice),
      billingCycleType: s.billingCycleType,
      billingCycleStart: s.billingCycleStart,
      billingCycleEnd: s.billingCycleEnd,
      createdAt: s.createdAt,
    }));

    return { items, total };
  }

  async listUsage(input: {
    page: number;
    limit: number;
    tenantId?: string;
  }): Promise<{ items: UsageListItem[]; total: number }> {
    const skip = (input.page - 1) * input.limit;
    const where: Record<string, unknown> = {};
    if (input.tenantId) where.tenantId = input.tenantId;

    const [records, total] = await Promise.all([
      this.prisma.usageRecord.findMany({
        where,
        skip,
        take: input.limit,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.usageRecord.count({ where }),
    ]);

    const tenantIds = [...new Set(records.map((r) => r.tenantId))];
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, companyName: true },
    });
    const tenantMap = new Map(tenants.map((t) => [t.id, t.companyName]));

    const subscriptions = await this.prisma.subscription.findMany({
      where: { tenantId: { in: tenantIds } },
      select: {
        tenantId: true,
        messagesQuota: true,
        aiTokensQuota: true,
        contactsQuota: true,
      },
    });
    const quotaMap = new Map(subscriptions.map((s) => [s.tenantId, s]));

    const items: UsageListItem[] = records.map((r) => {
      const quota = quotaMap.get(r.tenantId);
      return {
        tenantId: r.tenantId,
        companyName: tenantMap.get(r.tenantId) ?? 'Unknown',
        messagesUsed: r.messagesUsed,
        messagesQuota: quota?.messagesQuota ?? 0,
        aiTokensUsed: r.aiTokensUsed,
        aiTokensQuota: quota?.aiTokensQuota ?? 0,
        contactsUsed: r.contactsUsed,
        contactsQuota: quota?.contactsQuota ?? 0,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
      };
    });

    return { items, total };
  }
}
