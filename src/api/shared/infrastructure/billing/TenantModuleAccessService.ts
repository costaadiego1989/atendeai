import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/PrismaService';

export interface TenantBillingAccessSummary {
  subscriptionId?: string | null;
  plan?: string | null;
  status?: string | null;
  pricing: {
    baseMonthlyPrice: number;
    addonsMonthlyPrice: number;
    totalMonthlyPrice: number;
    pricingVersion?: string | null;
  };
  includedModules: string[];
  addonModules: string[];
  enabledModules: string[];
  moduleAccess: Record<string, boolean>;
}

@Injectable()
export class TenantModuleAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(tenantId: string): Promise<TenantBillingAccessSummary> {
    const [subscription] = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT
        id,
        plan,
        status,
        base_monthly_price AS "baseMonthlyPrice",
        addons_monthly_price AS "addonsMonthlyPrice",
        total_monthly_price AS "totalMonthlyPrice",
        pricing_version AS "pricingVersion"
      FROM billing_schema.subscriptions
      WHERE tenant_id = ${tenantId}::uuid
      LIMIT 1
    `);

    if (!subscription) {
      return {
        subscriptionId: null,
        plan: null,
        status: null,
        pricing: {
          baseMonthlyPrice: 0,
          addonsMonthlyPrice: 0,
          totalMonthlyPrice: 0,
          pricingVersion: null,
        },
        includedModules: [],
        addonModules: [],
        enabledModules: [],
        moduleAccess: {},
      };
    }

    const [catalogModules, subscriptionModules] = await Promise.all([
      this.prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT
          code,
          billing_mode AS "billingMode",
          included_in_plans AS "includedInPlans"
        FROM billing_schema.billing_modules
        WHERE active = TRUE
      `),
      this.prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT module_code AS "moduleCode"
        FROM billing_schema.subscription_modules
        WHERE subscription_id = ${subscription.id}::uuid
          AND status = 'ACTIVE'
      `),
    ]);

    const addonModules = Array.from(
      new Set(subscriptionModules.map((module) => module.moduleCode)),
    ).sort();

    const includedModules = Array.from(
      new Set(
        catalogModules
          .filter((module) => {
            const includedInPlans = Array.isArray(module.includedInPlans)
              ? module.includedInPlans
              : [];

            return (
              module.billingMode === 'INCLUDED' ||
              includedInPlans.includes(subscription.plan)
            );
          })
          .map((module) => module.code),
      ),
    ).sort();

    const enabledModules = Array.from(
      new Set([...includedModules, ...addonModules]),
    ).sort();

    const moduleAccess = Object.fromEntries(
      enabledModules.map((moduleCode) => [moduleCode, true]),
    );

    return {
      subscriptionId: subscription.id,
      plan: subscription.plan,
      status: subscription.status,
      pricing: {
        baseMonthlyPrice: Number(subscription.baseMonthlyPrice || 0),
        addonsMonthlyPrice: Number(subscription.addonsMonthlyPrice || 0),
        totalMonthlyPrice: Number(subscription.totalMonthlyPrice || 0),
        pricingVersion: subscription.pricingVersion ?? null,
      },
      includedModules,
      addonModules,
      enabledModules,
      moduleAccess,
    };
  }
}
