import { Subscription, BillingCycleType } from '@modules/billing/domain/entities/Subscription';
import { UsageRecord } from '@modules/billing/domain/entities/UsageRecord';
import { TenantId } from '@shared/domain/TenantId';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { Quotas, PlanType } from '@modules/billing/domain/value-objects/Quotas';
import {
  Prisma,
  Subscription as PrismaSubscription,
  UsageRecord as PrismaUsageRecord,
} from '@prisma/client';

export class BillingMapper {
  public static subscriptionToDomain(input: PrismaSubscription): Subscription {
    const raw = input as PrismaSubscription & {
      scheduledPlan?: string | null;
      tenant_id?: string;
      messages_quota?: number;
      ai_tokens_quota?: number;
      contacts_quota?: number;
      billing_cycle_start?: Date;
      billing_cycle_end?: Date;
      billing_cycle_type?: string | null;
      scheduled_plan?: string | null;
      asaas_customer_id?: string | null;
      asaas_subscription_id?: string | null;
      last_quota_alert_at?: Date | null;
      base_monthly_price?: Prisma.Decimal | number | null;
      addons_monthly_price?: Prisma.Decimal | number | null;
      total_monthly_price?: Prisma.Decimal | number | null;
      pricing_version?: string | null;
      pricing_snapshot?: any;
      config?: any;
      created_at?: Date;
    };

    return Subscription.reconstitute(
      {
        tenantId: TenantId.create(raw.tenantId ?? raw.tenant_id!),
        plan: (raw.plan ?? raw.plan) as PlanType,
        status: raw.status ?? raw.status!,
        quotas: Quotas.reconstitute(
          raw.messagesQuota ?? raw.messages_quota!,
          raw.aiTokensQuota ?? raw.ai_tokens_quota!,
          raw.contactsQuota ?? raw.contacts_quota!,
        ),
        billingCycleStart: raw.billingCycleStart ?? raw.billing_cycle_start!,
        billingCycleEnd: raw.billingCycleEnd ?? raw.billing_cycle_end!,
        billingCycleType: ((raw as any).billingCycleType ?? raw.billing_cycle_type ?? 'MONTHLY') as BillingCycleType,
        scheduledPlan: (raw.scheduledPlan ??
          raw.scheduled_plan ??
          undefined) as PlanType | undefined,
        asaasCustomerId:
          raw.asaasCustomerId ?? raw.asaas_customer_id ?? undefined,
        asaasSubscriptionId:
          raw.asaasSubscriptionId ?? raw.asaas_subscription_id ?? undefined,
        lastQuotaAlertAt:
          raw.lastQuotaAlertAt ?? raw.last_quota_alert_at ?? undefined,
        baseMonthlyPrice: Number(raw.base_monthly_price ?? 0),
        addonsMonthlyPrice: Number(raw.addons_monthly_price ?? 0),
        totalMonthlyPrice: Number(raw.total_monthly_price ?? 0),
        pricingVersion: raw.pricing_version ?? undefined,
        pricingSnapshot: raw.pricing_snapshot ?? {},
        config: raw.config ?? {},
        createdAt: raw.createdAt ?? raw.created_at!,
      },
      new UniqueEntityID(raw.id ?? raw.id),
    );
  }

  public static subscriptionToPersistence(sub: Subscription) {
    return {
      id: sub.id.toString(),
      tenantId: sub.tenantId.toString(),
      plan: sub.plan,
      status: sub.status,
      messagesQuota: sub.quotas.messages,
      aiTokensQuota: sub.quotas.aiTokens,
      contactsQuota: sub.quotas.contacts,
      billingCycleStart: sub.billingCycleStart,
      billingCycleEnd: sub.billingCycleEnd,
      billingCycleType: sub.billingCycleType,
      scheduledPlan: sub.scheduledPlan,
      asaasCustomerId: sub.asaasCustomerId,
      asaasSubscriptionId: sub.asaasSubscriptionId,
      lastQuotaAlertAt: sub.lastQuotaAlertAt,
      baseMonthlyPrice: sub.baseMonthlyPrice,
      addonsMonthlyPrice: sub.addonsMonthlyPrice,
      totalMonthlyPrice: sub.totalMonthlyPrice,
      pricingVersion: sub.pricingVersion,
      pricingSnapshot: sub.pricingSnapshot,
      config: sub.config,
      createdAt: sub.createdAt,
    };
  }

  public static usageToDomain(raw: PrismaUsageRecord): UsageRecord {
    return UsageRecord.reconstitute(
      {
        tenantId: TenantId.create(raw.tenantId),
        messagesUsed: raw.messagesUsed,
        aiTokensUsed: raw.aiTokensUsed,
        contactsUsed: raw.contactsUsed,
        periodStart: raw.periodStart,
        periodEnd: raw.periodEnd,
        updatedAt: raw.updatedAt,
      },
      new UniqueEntityID(raw.id),
    );
  }

  public static usageToPersistence(usage: UsageRecord) {
    return {
      id: usage.id.toString(),
      tenantId: usage.tenantId.toString(),
      periodStart: usage.periodStart,
      periodEnd: usage.periodEnd,
      messagesUsed: usage.messagesUsed,
      aiTokensUsed: usage.aiTokensUsed,
      contactsUsed: usage.contactsUsed,
      updatedAt: usage.updatedAt,
    };
  }
}
