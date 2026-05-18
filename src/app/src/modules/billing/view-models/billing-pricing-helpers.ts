export type BillingCycle = 'monthly' | 'annual';

export function getPromoDiscountPercent(): number {
  const raw = (import.meta.env.VITE_PROMO_DISCOUNT_PERCENT as string | undefined)?.trim();
  if (!raw) return 0;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) return 0;
  return parsed;
}

export function isPromoActive(): boolean {
  return getPromoDiscountPercent() > 0;
}

export function calculateMonthlyPrice(
  baseMonthlyPrice: number,
  cycle: BillingCycle,
): number {
  if (cycle === 'monthly') return baseMonthlyPrice;

  const discount = getPromoDiscountPercent();
  if (discount <= 0) return baseMonthlyPrice;

  return baseMonthlyPrice * (1 - discount / 100);
}

export function calculateAnnualTotal(baseMonthlyPrice: number): number {
  const monthlyWithDiscount = calculateMonthlyPrice(baseMonthlyPrice, 'annual');
  return monthlyWithDiscount * 12;
}

export function calculateAnnualSavings(baseMonthlyPrice: number): number {
  const fullYear = baseMonthlyPrice * 12;
  const discountedYear = calculateAnnualTotal(baseMonthlyPrice);
  return fullYear - discountedYear;
}
