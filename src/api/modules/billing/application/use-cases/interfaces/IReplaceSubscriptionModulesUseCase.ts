import { IUseCase } from '@shared/application/IUseCase';

export interface ReplaceSubscriptionModulesInput {
  tenantId: string;
  moduleCodes: string[];
}

export interface ReplaceSubscriptionModulesOutput {
  tenantId: string;
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
}

export interface IReplaceSubscriptionModulesUseCase extends IUseCase<
  ReplaceSubscriptionModulesInput,
  ReplaceSubscriptionModulesOutput
> {}

export const IReplaceSubscriptionModulesUseCase = Symbol(
  'IReplaceSubscriptionModulesUseCase',
);
