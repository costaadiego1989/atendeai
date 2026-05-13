import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { Subscription } from '@modules/billing/domain/entities/Subscription';
import { UsageRecord } from '@modules/billing/domain/entities/UsageRecord';
import { 
  IBillingRepository, 
  BillingPlanCatalogRecord,
  BillingModuleRecord,
  BusinessNicheRecord,
  SubscriptionModuleRecord,
} from '@modules/billing/domain/repositories/IBillingRepository';
import { BillingMapper } from '../mappers/BillingMapper';
import { PlanType } from '@modules/billing/domain/value-objects/Quotas';

@Injectable()
export class PrismaBillingRepository implements IBillingRepository {
  constructor(private readonly prisma: PrismaService) { }

  async findSubscription(tenantId: string): Promise<Subscription | null> {
    const [raw] = await this.prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT
          id,
          tenant_id,
          plan,
          status,
          messages_quota,
          ai_tokens_quota,
          contacts_quota,
          billing_cycle_start,
          billing_cycle_end,
          scheduled_plan,
          asaas_customer_id,
          asaas_subscription_id,
          last_quota_alert_at,
          base_monthly_price,
          addons_monthly_price,
          total_monthly_price,
          pricing_version,
          pricing_snapshot,
          config,
          created_at
        FROM billing_schema.subscriptions
        WHERE tenant_id = ${tenantId}::uuid
        LIMIT 1
      `);

    return raw ? BillingMapper.subscriptionToDomain(raw) : null;
  }

  async saveSubscription(sub: Subscription): Promise<void> {
    const data = BillingMapper.subscriptionToPersistence(sub);
    await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO billing_schema.subscriptions (
          id,
          tenant_id,
          plan,
          status,
          messages_quota,
          ai_tokens_quota,
          contacts_quota,
          billing_cycle_start,
          billing_cycle_end,
          scheduled_plan,
          asaas_customer_id,
          asaas_subscription_id,
          last_quota_alert_at,
          base_monthly_price,
          addons_monthly_price,
          total_monthly_price,
          pricing_version,
          pricing_snapshot,
          config,
          created_at
        )
        VALUES (
          ${data.id}::uuid,
          ${data.tenantId}::uuid,
          ${data.plan},
          ${data.status},
          ${data.messagesQuota},
          ${data.aiTokensQuota},
          ${data.contactsQuota},
          ${data.billingCycleStart}::date,
          ${data.billingCycleEnd}::date,
          ${data.scheduledPlan ?? null},
          ${data.asaasCustomerId ?? null},
          ${data.asaasSubscriptionId ?? null},
          ${data.lastQuotaAlertAt ?? null}::timestamptz,
          ${data.baseMonthlyPrice},
          ${data.addonsMonthlyPrice},
          ${data.totalMonthlyPrice},
          ${data.pricingVersion ?? null},
          ${JSON.stringify(data.pricingSnapshot || {})}::jsonb,
          ${JSON.stringify(data.config || {})}::jsonb,
          ${data.createdAt}::timestamptz
        )
        ON CONFLICT (tenant_id) DO UPDATE SET
          plan = EXCLUDED.plan,
          status = EXCLUDED.status,
          messages_quota = EXCLUDED.messages_quota,
          ai_tokens_quota = EXCLUDED.ai_tokens_quota,
          contacts_quota = EXCLUDED.contacts_quota,
          billing_cycle_start = EXCLUDED.billing_cycle_start,
          billing_cycle_end = EXCLUDED.billing_cycle_end,
          scheduled_plan = EXCLUDED.scheduled_plan,
          asaas_customer_id = EXCLUDED.asaas_customer_id,
          asaas_subscription_id = EXCLUDED.asaas_subscription_id,
          last_quota_alert_at = EXCLUDED.last_quota_alert_at,
          base_monthly_price = EXCLUDED.base_monthly_price,
          addons_monthly_price = EXCLUDED.addons_monthly_price,
          total_monthly_price = EXCLUDED.total_monthly_price,
          pricing_version = EXCLUDED.pricing_version,
          pricing_snapshot = EXCLUDED.pricing_snapshot,
          config = EXCLUDED.config
      `);
  }

  async listPlans(): Promise<BillingPlanCatalogRecord[]> {
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT
          code,
          display_name,
          description,
          monthly_price,
          messages_quota,
          ai_tokens_quota,
          contacts_quota,
          pricing_version,
          sort_order,
          active,
          features,
          is_standard,
          config
        FROM billing_schema.billing_plan_catalog
        WHERE active = TRUE
        ORDER BY sort_order ASC, code ASC
      `);

    return rows.map((row) => this.mapPlan(row));
  }

  async findPlanByCode(code: PlanType): Promise<BillingPlanCatalogRecord | null> {
    const [row] = await this.prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT
          code,
          display_name,
          description,
          monthly_price,
          messages_quota,
          ai_tokens_quota,
          contacts_quota,
          pricing_version,
          sort_order,
          active,
          features,
          is_standard,
          config
        FROM billing_schema.billing_plan_catalog
        WHERE code = ${code}
        LIMIT 1
      `);

    return row ? this.mapPlan(row) : null;
  }

  async findLatestUsage(tenantId: string): Promise<UsageRecord | null> {
    const raw = await this.prisma.usageRecord.findFirst({
      where: { tenantId },
      orderBy: { periodStart: 'desc' },
    });

    return raw ? BillingMapper.usageToDomain(raw) : null;
  }

  async getUsage(tenantId: string, start: Date): Promise<UsageRecord | null> {
    const raw = await this.prisma.usageRecord.findUnique({
      where: {
        tenantId_periodStart: {
          tenantId,
          periodStart: start,
        },
      },
    });

    return raw ? BillingMapper.usageToDomain(raw) : null;
  }

  async saveUsage(usage: UsageRecord): Promise<void> {
    const data = BillingMapper.usageToPersistence(usage);
    await this.prisma.usageRecord.upsert({
      where: {
        tenantId_periodStart: {
          tenantId: data.tenantId,
          periodStart: data.periodStart,
        },
      },
      create: data,
      update: {
        messagesUsed: data.messagesUsed,
        aiTokensUsed: data.aiTokensUsed,
        contactsUsed: data.contactsUsed,
        updatedAt: data.updatedAt,
      },
    });
  }

  async saveAuditLog(log: any): Promise<void> {
    await this.prisma.billingAuditLog.create({
      data: {
        tenantId: log.tenantId,
        event: log.event,
        oldPlan: log.oldPlan,
        newPlan: log.newPlan,
        metadata: log.metadata || {},
      },
    });
  }

  async listNiches(): Promise<BusinessNicheRecord[]> {
    const niches = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT
        n.*,
        COALESCE(
          (
            SELECT json_agg(nm.module_code ORDER BY nm.sort_order ASC, nm.module_code ASC)
            FROM billing_schema.niche_modules nm
            WHERE nm.niche_code = n.code
          ),
          '[]'::json
        ) as modules,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'moduleCode', nm.module_code,
                'isRecommended', nm.is_recommended,
                'isPrimary', nm.is_primary,
                'marketingHeadline', nm.marketing_headline,
                'salesPitch', nm.sales_pitch,
                'sortOrder', nm.sort_order
              )
              ORDER BY nm.sort_order ASC, nm.module_code ASC
            )
            FROM billing_schema.niche_modules nm
            WHERE nm.niche_code = n.code
          ),
          '[]'::json
        ) as recommendations
      FROM billing_schema.business_niches n
      WHERE n.active = TRUE
      ORDER BY n.display_name ASC
    `);

    return niches.map(n => ({
      code: n.code,
      displayName: n.display_name,
      description: n.description,
      pains: n.pains || [],
      iconName: n.icon_name,
      active: Boolean(n.active),
      modules: n.modules || [],
      recommendations: n.recommendations || [],
    }));
  }

  async listModules(): Promise<BillingModuleRecord[]> {
    const modules = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT
        code,
        display_name,
        description,
        category,
        billing_mode,
        monthly_price,
        pricing_version,
        sales_pitch,
        quota_impact,
        included_in_plans,
        config,
        active
      FROM billing_schema.billing_modules
      WHERE active = TRUE
      ORDER BY display_name ASC
    `);

    return modules.map(m => ({
      code: m.code,
      displayName: m.display_name,
      description: m.description,
      category: m.category,
      billingMode: m.billing_mode,
      monthlyPrice: Number(m.monthly_price || 0),
      pricingVersion: m.pricing_version,
      salesPitch: m.sales_pitch,
      quotaImpact: m.quota_impact || {},
      includedInPlans: m.included_in_plans || [],
      config: m.config || {},
      active: Boolean(m.active)
    }));
  }

  async listSubscriptionModules(
    subscriptionId: string,
  ): Promise<SubscriptionModuleRecord[]> {
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT
        subscription_id,
        tenant_id,
        module_code,
        status,
        monthly_price,
        pricing_version,
        pricing_snapshot,
        quota_impact,
        metadata,
        started_at,
        ended_at
      FROM billing_schema.subscription_modules
      WHERE subscription_id = ${subscriptionId}::uuid
      ORDER BY started_at ASC, module_code ASC
    `);

    return rows.map((row) => ({
      subscriptionId: row.subscription_id,
      tenantId: row.tenant_id,
      moduleCode: row.module_code,
      status: row.status,
      monthlyPrice: Number(row.monthly_price || 0),
      pricingVersion: row.pricing_version,
      pricingSnapshot: row.pricing_snapshot || {},
      quotaImpact: row.quota_impact || {},
      metadata: row.metadata || {},
      startedAt: row.started_at,
      endedAt: row.ended_at,
    }));
  }

  async replaceSubscriptionModules(
    subscriptionId: string,
    tenantId: string,
    modules: Array<Omit<SubscriptionModuleRecord, 'subscriptionId' | 'tenantId'>>,
  ): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      DELETE FROM billing_schema.subscription_modules
      WHERE subscription_id = ${subscriptionId}::uuid
    `);

    for (const module of modules) {
      await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO billing_schema.subscription_modules (
          subscription_id,
          tenant_id,
          module_code,
          status,
          monthly_price,
          pricing_version,
          pricing_snapshot,
          quota_impact,
          metadata,
          started_at,
          ended_at
        ) VALUES (
          ${subscriptionId}::uuid,
          ${tenantId}::uuid,
          ${module.moduleCode},
          ${module.status},
          ${module.monthlyPrice},
          ${module.pricingVersion ?? null},
          ${JSON.stringify(module.pricingSnapshot || {})}::jsonb,
          ${JSON.stringify(module.quotaImpact || {})}::jsonb,
          ${JSON.stringify(module.metadata || {})}::jsonb,
          ${module.startedAt}::timestamptz,
          ${module.endedAt ?? null}::timestamptz
        )
      `);
    }
  }

  async findActiveSubscriptionModule(
    tenantId: string,
    moduleCode: string,
  ): Promise<SubscriptionModuleRecord | null> {
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT
        subscription_id,
        tenant_id,
        module_code,
        status,
        monthly_price,
        pricing_version,
        pricing_snapshot,
        quota_impact,
        metadata,
        started_at,
        ended_at
      FROM billing_schema.subscription_modules
      WHERE tenant_id = ${tenantId}::uuid
        AND module_code = ${moduleCode}
        AND status = 'ACTIVE'
      LIMIT 1
    `);

    if (!rows.length) return null;

    const row = rows[0];
    return {
      subscriptionId: row.subscription_id,
      tenantId: row.tenant_id,
      moduleCode: row.module_code,
      status: row.status,
      monthlyPrice: Number(row.monthly_price || 0),
      pricingVersion: row.pricing_version,
      pricingSnapshot: row.pricing_snapshot || {},
      quotaImpact: row.quota_impact || {},
      metadata: row.metadata || {},
      startedAt: row.started_at,
      endedAt: row.ended_at,
    };
  }

  async saveSubscriptionModule(
    tenantId: string,
    subscriptionId: string,
    module: Omit<SubscriptionModuleRecord, 'subscriptionId' | 'tenantId'>,
  ): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO billing_schema.subscription_modules (
        subscription_id,
        tenant_id,
        module_code,
        status,
        monthly_price,
        pricing_version,
        pricing_snapshot,
        quota_impact,
        metadata,
        started_at,
        ended_at
      ) VALUES (
        ${subscriptionId}::uuid,
        ${tenantId}::uuid,
        ${module.moduleCode},
        ${module.status},
        ${module.monthlyPrice},
        ${module.pricingVersion ?? null},
        ${JSON.stringify(module.pricingSnapshot || {})}::jsonb,
        ${JSON.stringify(module.quotaImpact || {})}::jsonb,
        ${JSON.stringify(module.metadata || {})}::jsonb,
        ${module.startedAt}::timestamptz,
        ${module.endedAt ?? null}::timestamptz
      )
    `);
  }

  async updateSubscriptionModuleStatus(
    tenantId: string,
    moduleCode: string,
    status: string,
    endedAt?: Date,
  ): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE billing_schema.subscription_modules
      SET status = ${status},
          ended_at = ${endedAt ?? null}::timestamptz,
          updated_at = NOW()
      WHERE tenant_id = ${tenantId}::uuid
        AND module_code = ${moduleCode}
        AND status = 'ACTIVE'
    `);
  }

  private mapPlan(row: any): BillingPlanCatalogRecord {
    return {
      code: row.code,
      displayName: row.display_name ?? row.displayName,
      description: row.description ?? null,
      monthlyPrice: Number(row.monthly_price ?? row.monthlyPrice ?? 0),
      messagesQuota: row.messages_quota ?? row.messagesQuota,
      aiTokensQuota: row.ai_tokens_quota ?? row.aiTokensQuota,
      contactsQuota: row.contacts_quota ?? row.contactsQuota,
      pricingVersion: row.pricing_version ?? row.pricingVersion ?? null,
      sortOrder: row.sort_order ?? row.sortOrder ?? 0,
      active: Boolean(row.active),
      features: row.features ?? [],
      isStandard: Boolean(row.is_standard ?? row.isStandard ?? false),
      config: row.config ?? {},
    };
  }
}
