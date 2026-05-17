import {
  BillingPlanCatalogRecord,
  SubscriptionModuleRecord,
} from '../../domain/repositories/IBillingRepository';
import { Quotas } from '../../domain/value-objects/Quotas';

export interface SubscriptionCommercialState {
  quotas: Quotas;
  baseMonthlyPrice: number;
  addonsMonthlyPrice: number;
  totalMonthlyPrice: number;
  pricingVersion?: string;
  pricingSnapshot: any;
  config: any;
}

export function buildSubscriptionCommercialState(
  planDefinition: BillingPlanCatalogRecord,
  modules: SubscriptionModuleRecord[] = [],
  currentConfig: any = {},
): SubscriptionCommercialState {
  const addonsMonthlyPrice = modules
    .filter((module) => module.status === 'ACTIVE')
    .reduce((sum, module) => sum + Number(module.monthlyPrice || 0), 0);

  const activeModules = modules
    .filter((module) => module.status === 'ACTIVE')
    .map((module) => module.moduleCode);

  const basePlanModules = Object.entries(planDefinition.config?.modules || {})
    .filter(([, enabled]) => Boolean(enabled))
    .map(([code]) => code);

  return {
    quotas: Quotas.reconstitute(
      planDefinition.messagesQuota,
      planDefinition.aiTokensQuota,
      planDefinition.contactsQuota,
    ),
    baseMonthlyPrice: Number(planDefinition.monthlyPrice || 0),
    addonsMonthlyPrice,
    totalMonthlyPrice:
      Number(planDefinition.monthlyPrice || 0) + addonsMonthlyPrice,
    pricingVersion: planDefinition.pricingVersion ?? undefined,
    pricingSnapshot: {
      plan: {
        code: planDefinition.code,
        displayName: planDefinition.displayName,
        monthlyPrice: Number(planDefinition.monthlyPrice || 0),
        quotas: {
          messages: planDefinition.messagesQuota,
          aiTokens: planDefinition.aiTokensQuota,
          contacts: planDefinition.contactsQuota,
        },
        pricingVersion: planDefinition.pricingVersion ?? undefined,
      },
      addons: modules.map((module) => ({
        moduleCode: module.moduleCode,
        status: module.status,
        monthlyPrice: Number(module.monthlyPrice || 0),
        pricingVersion: module.pricingVersion ?? undefined,
      })),
    },
    config: {
      ...currentConfig,
      modules: {
        ...Object.fromEntries(basePlanModules.map((code) => [code, true])),
        ...Object.fromEntries(activeModules.map((code) => [code, true])),
      },
    },
  };
}
