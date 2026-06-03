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
// Sales sub-routes — used to grant specific sales features per niche
// instead of '/app/sales' (too broad — catches all /app/sales/* sub-routes)
const SALES_METRICS = '/app/sales/metrics';
const SALES_PAYMENT_LINKS = '/app/sales/payment-links';
const SALES_PROMOTIONS = '/app/sales/promotions';
const SALES_ALL = [SALES_METRICS, SALES_PAYMENT_LINKS, SALES_PROMOTIONS];

const nicheRoutes: Record<NicheCode, string[]> = {
  // Commerce-oriented niches — full sales suite
  FOOD: ['/app/catalog', '/app/inventory', '/app/checkout', ...SALES_ALL],
  RETAIL: ['/app/catalog', '/app/inventory', '/app/checkout', ...SALES_ALL],
  ECOMMERCE: ['/app/catalog', '/app/inventory', '/app/checkout', ...SALES_ALL, '/app/prospecting'],
  MARKET: ['/app/catalog', '/app/inventory', '/app/checkout', ...SALES_ALL],
  GROCERY: ['/app/catalog', '/app/inventory', '/app/checkout', ...SALES_ALL],
  BAKERY: ['/app/catalog', '/app/inventory', '/app/checkout', ...SALES_ALL],
  CAFETERIA: ['/app/catalog', '/app/inventory', '/app/checkout', ...SALES_ALL],
  SUPERMARKET: ['/app/catalog', '/app/inventory', '/app/checkout', ...SALES_ALL],

  // Scheduling-oriented niches — no checkout, no inventory, no proposals
  BEAUTY: ['/app/scheduling', SALES_METRICS, SALES_PAYMENT_LINKS, SALES_PROMOTIONS, '/app/recovery'],
  HEALTH: ['/app/scheduling', SALES_METRICS, SALES_PAYMENT_LINKS, '/app/recovery'],
  GYM: ['/app/scheduling', SALES_METRICS, SALES_PAYMENT_LINKS, SALES_PROMOTIONS, '/app/recovery'],
  PET: ['/app/scheduling', SALES_METRICS, SALES_PAYMENT_LINKS, '/app/recovery'],
  HOME_SERV: ['/app/scheduling', '/app/prospecting', '/app/proposals', SALES_METRICS, SALES_PAYMENT_LINKS, '/app/recovery'],
  HOSPITALITY: ['/app/scheduling', '/app/catalog', '/app/checkout', SALES_METRICS, SALES_PAYMENT_LINKS, SALES_PROMOTIONS, '/app/recovery'],
  LEGAL: ['/app/scheduling', '/app/prospecting', '/app/proposals', SALES_METRICS, '/app/recovery'],
  CLINIC: ['/app/scheduling', SALES_METRICS, SALES_PAYMENT_LINKS, '/app/recovery'],
  SCHEDULING: ['/app/scheduling', '/app/catalog', SALES_METRICS, SALES_PAYMENT_LINKS, '/app/recovery'],

  // Service/consultive niches
  AGENCY: ['/app/prospecting', '/app/proposals', SALES_METRICS, '/app/recovery', '/app/social'],
  REALESTATE: ['/app/catalog', '/app/prospecting', '/app/proposals', '/app/scheduling', SALES_METRICS, '/app/recovery'],
  RENTAL: ['/app/catalog', '/app/prospecting', '/app/proposals', '/app/scheduling', SALES_METRICS, '/app/recovery'],
  EDUCATION: ['/app/catalog', '/app/scheduling', '/app/prospecting', '/app/proposals', SALES_METRICS, SALES_PAYMENT_LINKS, '/app/recovery'],
  AUTOMOTIVE: ['/app/scheduling', '/app/catalog', '/app/inventory', '/app/checkout', '/app/proposals', ...SALES_ALL, '/app/prospecting'],
  SIMPLE_SERVICE: ['/app/prospecting', '/app/proposals', SALES_METRICS, '/app/recovery'],

  // Recovery-focused
  RECOVERY: ['/app/recovery', SALES_METRICS, '/app/prospecting'],
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
export function filterNavByNiche(items: NavItem[], businessType?: string | null, _userRole?: string | null): NavItem[] {
  if (!isNicheFilterEnabled()) {
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
