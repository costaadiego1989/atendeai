import { PlanType } from '../value-objects/Quotas';
import { PLAN_QUOTAS } from './PlanQuotas';

export interface AddonPackageDefinition {
  messages: number;
  aiTokens: number;
  contacts: number;
  /** Price in cents — half of the plan's monthly price */
  priceMultiplier: number;
}

/**
 * Returns the addon package definition for a given plan.
 * Addon packages provide half the quotas of the plan at half the price.
 * Not available for TRIAL plans.
 */
export function getAddonPackageForPlan(
  plan: PlanType,
): AddonPackageDefinition | null {
  if (plan === 'TRIAL') {
    return null;
  }

  const quotas = PLAN_QUOTAS[plan];

  return {
    messages: Math.floor(quotas.messages / 2),
    aiTokens: Math.floor(quotas.aiTokens / 2),
    contacts: Math.floor(quotas.contacts / 2),
    priceMultiplier: 0.5,
  };
}

export const ADDON_PACKAGE_MODULE_CODE = 'quota-boost';
