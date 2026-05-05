import { IUseCase } from '@shared/application/IUseCase';

export interface GetSubscriptionCatalogInput {
  tenantId: string;
}

export interface GetSubscriptionCatalogOutput {
  tenantId: string;
  businessType?: string | null;
  niche: {
    code: string;
    displayName: string;
    description?: string | null;
    pains: string[];
  } | null;
  subscription: {
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
  };
  availableAddons: Array<{
    code: string;
    displayName: string;
    description?: string | null;
    category?: string | null;
    monthlyPrice: number;
    pricingVersion?: string | null;
    salesPitch?: string | null;
    includedInPlans: string[];
    subscribed: boolean;
    includedInPlan: boolean;
    enabled: boolean;
    recommended: boolean;
    primaryRecommendation: boolean;
    marketingHeadline?: string | null;
    recommendationSalesPitch?: string | null;
    selectable: boolean;
  }>;
}

export interface IGetSubscriptionCatalogUseCase
  extends IUseCase<GetSubscriptionCatalogInput, GetSubscriptionCatalogOutput> {}

export const IGetSubscriptionCatalogUseCase = Symbol(
  'IGetSubscriptionCatalogUseCase',
);
