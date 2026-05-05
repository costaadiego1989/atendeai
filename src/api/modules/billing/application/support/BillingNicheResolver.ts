const BUSINESS_TYPE_TO_NICHE: Record<string, string> = {
  RETAIL: 'RETAIL',
  ECOMMERCE: 'ECOMMERCE',
  FOOD: 'FOOD',
  HEALTH: 'HEALTH',
  BEAUTY: 'BEAUTY',
  PET: 'BEAUTY',
  GYM: 'BEAUTY',
  SCHEDULING: 'HEALTH',
  CLINIC: 'HEALTH',
  BAKERY: 'FOOD',
  CAFETERIA: 'FOOD',
  SUPERMARKET: 'FOOD',
  MARKET: 'FOOD',
  GROCERY: 'FOOD',
  RECOVERY: 'RECOVERY',
  LEGAL: 'HOME_SERV',
  REALESTATE: 'HOME_SERV',
  AGENCY: 'HOME_SERV',
  EDUCATION: 'HOME_SERV',
  AUTOMOTIVE: 'HOME_SERV',
  HOME_SERV: 'HOME_SERV',
  HOSPITALITY: 'HOME_SERV',
  SIMPLE_SERVICE: 'HOME_SERV',
  RENTAL: 'HOME_SERV',
  OTHER: 'HOME_SERV',
};

export function resolveBillingNicheCode(
  businessType?: string | null,
): string | null {
  if (!businessType) {
    return null;
  }

  return BUSINESS_TYPE_TO_NICHE[businessType] ?? businessType ?? null;
}
