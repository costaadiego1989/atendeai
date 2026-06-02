/**
 * Maps business niche to allowed navigation routes.
 * Filtering is active by default. Set VITE_FILTER_MODULES_BY_NICHE=false to disable.
 */

type NicheCode = string;

/**
 * Each niche maps to a set of route prefixes that should be visible.
 * Routes not listed here will be hidden when filtering is active.
 * Core routes (dashboard, conversations, contacts, settings) are always visible.
 */
const nicheRoutes: Record<NicheCode, string[]> = {
  // Commerce-oriented niches — recovery is not part of the commerce flow
  FOOD: ['/app/catalog', '/app/inventory', '/app/checkout', '/app/sales'],
  RETAIL: ['/app/catalog', '/app/inventory', '/app/checkout', '/app/sales'],
  ECOMMERCE: ['/app/catalog', '/app/inventory', '/app/checkout', '/app/sales', '/app/prospecting'],
  MARKET: ['/app/catalog', '/app/inventory', '/app/checkout', '/app/sales'],
  GROCERY: ['/app/catalog', '/app/inventory', '/app/checkout', '/app/sales'],
  BAKERY: ['/app/catalog', '/app/inventory', '/app/checkout', '/app/sales'],
  CAFETERIA: ['/app/catalog', '/app/inventory', '/app/checkout', '/app/sales'],
  SUPERMARKET: ['/app/catalog', '/app/inventory', '/app/checkout', '/app/sales'],

  // Scheduling-oriented niches
  BEAUTY: ['/app/scheduling', '/app/catalog', '/app/sales', '/app/recovery'],
  HEALTH: ['/app/scheduling', '/app/catalog', '/app/sales', '/app/recovery'],
  GYM: ['/app/scheduling', '/app/recovery', '/app/sales'],
  PET: ['/app/scheduling', '/app/catalog', '/app/sales', '/app/recovery'],
  HOME_SERV: ['/app/scheduling', '/app/prospecting', '/app/proposals', '/app/sales', '/app/recovery'],
  HOSPITALITY: ['/app/scheduling', '/app/catalog', '/app/checkout', '/app/recovery', '/app/sales'],
  LEGAL: ['/app/scheduling', '/app/prospecting', '/app/proposals', '/app/recovery', '/app/sales'],
  CLINIC: ['/app/scheduling', '/app/catalog', '/app/sales', '/app/recovery'],
  SCHEDULING: ['/app/scheduling', '/app/catalog', '/app/sales', '/app/recovery'],

  // Service/consultive niches
  AGENCY: ['/app/prospecting', '/app/proposals', '/app/recovery', '/app/sales', '/app/social'],
  REALESTATE: ['/app/catalog', '/app/prospecting', '/app/proposals', '/app/scheduling', '/app/recovery', '/app/sales'],
  RENTAL: ['/app/catalog', '/app/prospecting', '/app/proposals', '/app/scheduling', '/app/recovery', '/app/sales'],
  EDUCATION: ['/app/catalog', '/app/scheduling', '/app/prospecting', '/app/recovery', '/app/proposals', '/app/sales'],
  AUTOMOTIVE: ['/app/scheduling', '/app/catalog', '/app/inventory', '/app/checkout', '/app/proposals', '/app/sales', '/app/prospecting'],
  SIMPLE_SERVICE: ['/app/prospecting', '/app/proposals', '/app/recovery', '/app/sales'],

  // Recovery-focused
  RECOVERY: ['/app/recovery', '/app/sales', '/app/prospecting'],
};

/**
 * Portuguese/accented business type strings → canonical niche codes.
 * Defined at module scope to avoid per-call allocation.
 */
const nicheAliases: Record<string, string> = {
  CLINICA: 'CLINIC',
  CLINICA_E_SAUDE: 'CLINIC',
  SAUDE: 'HEALTH',
  BELEZA: 'BEAUTY',
  ACADEMIA: 'GYM',
  JURIDICO: 'LEGAL',
  IMOBILIARIA: 'REALESTATE',
  EDUCACAO: 'EDUCATION',
  AUTOMOTIVO: 'AUTOMOTIVE',
};

/** Routes that are always visible regardless of niche */
const alwaysVisiblePrefixes = [
  '/app/dashboard',
  '/app/conversations',
  '/app/contacts',
  '/app/social',
  '/app/settings',
  '/app/billing',
  '/app/team',
];

export interface NavItem {
  label: string;
  path: string;
  icon: any;
}

/**
 * Returns whether niche-based module filtering is enabled.
 * Active by default; set VITE_FILTER_MODULES_BY_NICHE=false to disable.
 */
export function isNicheFilterEnabled(): boolean {
  return import.meta.env.VITE_FILTER_MODULES_BY_NICHE !== 'false';
}

/**
 * Filters navigation items based on the tenant's business type.
 * If filtering is disabled, no businessType is set, or user is OWNER, returns all items.
 * OWNER role bypasses filtering to allow validation of all modules.
 */
export function filterNavByNiche(items: NavItem[], businessType?: string | null, userRole?: string | null): NavItem[] {
  if (!isNicheFilterEnabled()) {
    return items;
  }

  // OWNER bypasses niche filtering to validate all modules
  if (userRole === 'OWNER') {
    return items;
  }

  if (!businessType) {
    return items;
  }

  const niche = businessType
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');

  const resolvedNiche = nicheAliases[niche] ?? niche;
  const allowedRoutes = nicheRoutes[resolvedNiche];

  // If niche is not mapped, show everything (safe fallback)
  if (!allowedRoutes) {
    return items;
  }

  return items.filter((item) => {
    // Always-visible routes pass through
    if (alwaysVisiblePrefixes.some((prefix) => item.path.startsWith(prefix))) {
      return true;
    }

    // Check if the item's route matches any allowed route for this niche
    return allowedRoutes.some((route) => item.path.startsWith(route));
  });
}
