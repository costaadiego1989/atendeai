import { Subscription } from '../entities/Subscription';
import { UsageRecord } from '../entities/UsageRecord';
import { PlanType } from '../value-objects/Quotas';

export interface BillingPlanCatalogRecord {
  code: PlanType;
  displayName: string;
  description?: string | null;
  monthlyPrice: number;
  messagesQuota: number;
  aiTokensQuota: number;
  contactsQuota: number;
  pricingVersion?: string | null;
  sortOrder: number;
  active: boolean;
  features: string[];
  isStandard: boolean;
  config: any;
}

export interface BillingModuleRecord {
  code: string;
  displayName: string;
  description?: string | null;
  category?: string | null;
  billingMode: string;
  monthlyPrice: number;
  pricingVersion?: string | null;
  salesPitch?: string | null;
  quotaImpact: any;
  includedInPlans: string[];
  config: any;
  active: boolean;
}

export interface SubscriptionModuleRecord {
  subscriptionId: string;
  tenantId: string;
  moduleCode: string;
  status: string;
  monthlyPrice: number;
  pricingVersion?: string | null;
  pricingSnapshot: any;
  quotaImpact: any;
  metadata: any;
  startedAt: Date;
  endedAt?: Date | null;
}

export interface NicheModuleRecommendationRecord {
  moduleCode: string;
  isRecommended: boolean;
  isPrimary: boolean;
  marketingHeadline?: string | null;
  salesPitch?: string | null;
  sortOrder: number;
}

export interface BusinessNicheRecord {
  code: string;
  displayName: string;
  description?: string | null;
  pains: string[];
  iconName?: string | null;
  active: boolean;
  modules: string[]; // List of module codes
  recommendations?: NicheModuleRecommendationRecord[];
}

export interface BillingAuditLogRecord {
  tenantId: string;
  event: string;
  oldPlan?: string;
  newPlan?: string;
  metadata?: any;
}

export interface IBillingRepository {
  findSubscription(tenantId: string): Promise<Subscription | null>;
  saveSubscription(sub: Subscription): Promise<void>;
  listPlans(): Promise<BillingPlanCatalogRecord[]>;
  findPlanByCode(code: PlanType): Promise<BillingPlanCatalogRecord | null>;
  findLatestUsage(tenantId: string): Promise<UsageRecord | null>;
  getUsage(tenantId: string, start: Date): Promise<UsageRecord | null>;
  saveUsage(usage: UsageRecord): Promise<void>;
  saveAuditLog(log: BillingAuditLogRecord): Promise<void>;
  listNiches(): Promise<BusinessNicheRecord[]>;
  listModules(): Promise<BillingModuleRecord[]>;
  listSubscriptionModules(
    subscriptionId: string,
  ): Promise<SubscriptionModuleRecord[]>;
  findActiveSubscriptionModule(
    tenantId: string,
    moduleCode: string,
  ): Promise<SubscriptionModuleRecord | null>;
  saveSubscriptionModule(
    tenantId: string,
    subscriptionId: string,
    module: Omit<SubscriptionModuleRecord, 'subscriptionId' | 'tenantId'>,
  ): Promise<void>;
  updateSubscriptionModuleStatus(
    tenantId: string,
    moduleCode: string,
    status: string,
    endedAt?: Date,
  ): Promise<void>;
  replaceSubscriptionModules(
    subscriptionId: string,
    tenantId: string,
    modules: Array<
      Omit<SubscriptionModuleRecord, 'subscriptionId' | 'tenantId'>
    >,
  ): Promise<void>;
}

export const BILLING_REPOSITORY = Symbol('BILLING_REPOSITORY');
