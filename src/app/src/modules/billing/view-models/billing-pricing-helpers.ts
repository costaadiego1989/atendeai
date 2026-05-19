/**
 * Helpers for promotional pricing and annual billing.
 *
 * VITE_PROMO_DISCOUNT_MONTHLY — launch discount for monthly cycle (0-100).
 * VITE_PROMO_DISCOUNT_ANNUAL  — launch discount for annual cycle (0-100).
 */

export type BillingCycle = 'monthly' | 'annual';

function parseEnvPercent(raw: string | undefined): number {
  const trimmed = raw?.trim();
  if (!trimmed) return 0;
  const parsed = Number(trimmed);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) return 0;
  return parsed;
}

export function getPromoDiscountPercentMonthly(): number {
  return parseEnvPercent(import.meta.env.VITE_PROMO_DISCOUNT_MONTHLY as string | undefined);
}

export function getPromoDiscountPercentAnnual(): number {
  return parseEnvPercent(import.meta.env.VITE_PROMO_DISCOUNT_ANNUAL as string | undefined);
}

export function getPromoDiscountPercent(cycle: BillingCycle = 'monthly'): number {
  return cycle === 'annual' ? getPromoDiscountPercentAnnual() : getPromoDiscountPercentMonthly();
}

export function isPromoActive(): boolean {
  return getPromoDiscountPercentMonthly() > 0 || getPromoDiscountPercentAnnual() > 0;
}

export function calculateMonthlyPrice(
  baseMonthlyPrice: number,
  cycle: BillingCycle = 'monthly',
): number {
  const discount = getPromoDiscountPercent(cycle);
  if (discount <= 0) return baseMonthlyPrice;
  return baseMonthlyPrice * (1 - discount / 100);
}

export function calculateAnnualTotal(baseMonthlyPrice: number): number {
  return calculateMonthlyPrice(baseMonthlyPrice, 'annual') * 12;
}

export function calculateAnnualSavings(baseMonthlyPrice: number): number {
  return baseMonthlyPrice * 12 - calculateAnnualTotal(baseMonthlyPrice);
}
