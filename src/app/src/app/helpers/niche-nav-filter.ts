/**
 * Maps business niche to allowed navigation routes.
 * When VITE_FILTER_MODULES_BY_NICHE=true, only routes relevant to the
 * tenant's niche are shown in the sidebar. When false, all routes are visible.
 */

type NicheCode = string;

/**
 * Each niche maps to a set of route prefixes that should be visible.
 * Routes not listed here will be hidden when filtering is active.
 * Core routes (dashboard, conversations, contacts, settings) are always visible.
 */
const nicheRoutes: Record<NicheCode, string[]> = {
  // Commerce-oriented niches
  FOOD: ['/app/catalog', '/app/inventory', '/app/checkout', '/app/sales', '/app/recovery'],
  RETAIL: ['/app/catalog', '/app/inventory', '/app/checkout', '/app/sales', '/app/recovery'],
  ECOMMERCE: ['/app/catalog', '/app/inventory', '/app/checkout', '/app/sales', '/app/prospecting'],
  MARKET: ['/app/catalog', '/app/inventory', '/app/checkout', '/app/sales', '/app/recovery'],
  GROCERY: ['/app/catalog', '/app/inventory', '/app/checkout', '/app/sales', '/app/recovery'],
  BAKERY: ['/app/catalog', '/app/inventory', '/app/checkout', '/app/sales', '/app/recovery'],
  CAFETERIA: ['/app/catalog', '/app/inventory', '/app/checkout', '/app/sales', '/app/recovery'],
  SUPERMARKET: ['/app/catalog', '/app/inventory', '/app/checkout', '/app/sales', '/app/recovery'],

  // Scheduling-oriented niches
  BEAUTY: ['/app/scheduling', '/app/catalog', '/app/sales', '/app/recovery'],
  HEALTH: ['/app/scheduling', '/app/catalog', '/app/sales', '/app/recovery'],
  GYM: ['/app/scheduling', '/app/recovery', '/app/sales'],
  PET: ['/app/scheduling', '/app/catalog', '/app/sales', '/app/recovery'],
  HOME_SERV: ['/app/scheduling', '/app/prospecting', '/app/sales', '/app/recovery'],
  HOSPITALITY: ['/app/scheduling', '/app/checkout', '/app/sales'],
  LEGAL: ['/app/scheduling', '/app/proposals', '/app/recovery', '/app/sales'],
  CLINIC: ['/app/scheduling', '/app/catalog', '/app/sales', '/app/recovery'],
  SCHEDULING: ['/app/scheduling', '/app/catalog', '/app/sales', '/app/recovery'],

  // Service/consultive niches
  AGENCY: ['/app/prospecting', '/app/proposals', '/app/sales', '/app/social'],
  REALESTATE: ['/app/prospecting', '/app/proposals', '/app/scheduling', '/app/sales'],
  EDUCATION: ['/app/scheduling', '/app/recovery', '/app/sales', '/app/proposals'],
  AUTOMOTIVE: ['/app/scheduling', '/app/catalog', '/app/checkout', '/app/sales', '/app/prospecting'],

  // Recovery-focused
  RECOVERY: ['/app/recovery', '/app/sales', '/app/prospecting'],
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
 */
export function isNicheFilterEnabled(): boolean {
  return import.meta.env.VITE_FILTER_MODULES_BY_NICHE === 'true';
}

/**
 * Filters navigation items based on the tenant's business type.
 * If filtering is disabled or no businessType is set, returns all items.
 */
export function filterNavByNiche(items: NavItem[], businessType?: string | null): NavItem[] {
  if (!isNicheFilterEnabled()) {
    return items;
  }

  if (!businessType) {
    return items;
  }

  const niche = businessType.trim().toUpperCase();
  const allowedRoutes = nicheRoutes[niche];

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
