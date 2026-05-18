/**
 * Helpers for promotional pricing and annual billing.
 *
 * VITE_PROMO_DISCOUNT_PERCENT controls the launch discount (0-100).
 * When set to "50", all plans get 50% off (mensal e anual).
 */

export type BillingCycle = 'monthly' | 'annual';

/**
 * Returns the configured promo discount percentage (0-100).
 * Returns 0 if not configured or invalid.
 */
export function getPromoDiscountPercent(): number {
  const raw = (import.meta.env.VITE_PROMO_DISCOUNT_PERCENT as string | undefined)?.trim();
  if (!raw) return 0;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) return 0;
  return parsed;
}

/**
 * Whether a promotional discount is currently active.
 */
export function isPromoActive(): boolean {
  return getPromoDiscountPercent() > 0;
}

/**
 * Calculates the monthly price applying promo discount.
 * The discount applies to both monthly and annual cycles.
 */
export function calculateMonthlyPrice(
  baseMonthlyPrice: number,
  _cycle?: BillingCycle,
): number {
  const discount = getPromoDiscountPercent();
  if (discount <= 0) return baseMonthlyPrice;
  return baseMonthlyPrice * (1 - discount / 100);
}

/**
 * Calculates the total annual price (12 months with promo discount applied).
 */
export function calculateAnnualTotal(baseMonthlyPrice: number): number {
  const monthlyWithDiscount = calculateMonthlyPrice(baseMonthlyPrice);
  return monthlyWithDiscount * 12;
}

/**
 * Calculates how much the user saves per year with annual billing vs full price.
 */
export function calculateAnnualSavings(baseMonthlyPrice: number): number {
  const fullYear = baseMonthlyPrice * 12;
  const discountedYear = calculateAnnualTotal(baseMonthlyPrice);
  return fullYear - discountedYear;
}
