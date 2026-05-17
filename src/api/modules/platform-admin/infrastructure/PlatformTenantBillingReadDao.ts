import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';

export interface PlatformTenantOverviewItem {
  tenantId: string;
  companyName: string;
  cnpj: string;
  tenantPlan: string;
  tenantPlanStatus: string;
  tenantCreatedAt: Date;
  subscription: {
    plan: string;
    status: string;
    subscribedAt: Date;
    cycleStart: Date;
    cycleEnd: Date;
  } | null;
  quotas: {
    messages: { limit: number };
    aiTokens: { limit: number };
    contacts: { limit: number };
  };
  usage: {
    messages: { used: number };
    aiTokens: { used: number };
    contacts: { used: number };
    periodStart: Date | null;
    periodEnd: Date | null;
  };
}

@Injectable()
export class PlatformTenantBillingReadDao {
  constructor(private readonly prisma: PrismaService) {}

  async listOverview(input: {
    page: number;
    limit: number;
  }): Promise<{ items: PlatformTenantOverviewItem[]; total: number }> {
    const skip = (input.page - 1) * input.limit;
    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        skip,
        take: input.limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          companyName: true,
          cnpj: true,
          plan: true,
          planStatus: true,
          createdAt: true,
        },
      }),
      this.prisma.tenant.count(),
    ]);

    const ids = tenants.map((t) => t.id);
    if (ids.length === 0) {
      return { items: [], total };
    }

    const [subscriptions, usages] = await Promise.all([
      this.prisma.subscription.findMany({
        where: { tenantId: { in: ids } },
      }),
      this.prisma.usageRecord.findMany({
        where: { tenantId: { in: ids } },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const subByTenant = new Map(subscriptions.map((s) => [s.tenantId, s]));
    const usageByTenant = new Map<string, (typeof usages)[number]>();
    for (const u of usages) {
      if (!usageByTenant.has(u.tenantId)) {
        usageByTenant.set(u.tenantId, u);
      }
    }

    const items: PlatformTenantOverviewItem[] = tenants.map((t) => {
      const s = subByTenant.get(t.id);
      const u = usageByTenant.get(t.id);
      return {
        tenantId: t.id,
        companyName: t.companyName,
        cnpj: t.cnpj,
        tenantPlan: t.plan,
        tenantPlanStatus: t.planStatus,
        tenantCreatedAt: t.createdAt,
        subscription: s
          ? {
              plan: s.plan,
              status: s.status,
              subscribedAt: s.createdAt,
              cycleStart: s.billingCycleStart,
              cycleEnd: s.billingCycleEnd,
            }
          : null,
        quotas: {
          messages: { limit: s?.messagesQuota ?? 0 },
          aiTokens: { limit: s?.aiTokensQuota ?? 0 },
          contacts: { limit: s?.contactsQuota ?? 0 },
        },
        usage: {
          messages: { used: u?.messagesUsed ?? 0 },
          aiTokens: { used: u?.aiTokensUsed ?? 0 },
          contacts: { used: u?.contactsUsed ?? 0 },
          periodStart: u?.periodStart ?? null,
          periodEnd: u?.periodEnd ?? null,
        },
      };
    });

    return { items, total };
  }
}
