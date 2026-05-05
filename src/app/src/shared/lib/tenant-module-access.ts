import type { Tenant } from '@/shared/types';

export function hasTenantModuleAccess(
  tenant: Tenant | null | undefined,
  moduleCode: string,
): boolean {
  if (!tenant || !moduleCode) {
    return false;
  }

  return Boolean(tenant.billingAccess?.moduleAccess?.[moduleCode]);
}

export function getTenantEnabledModules(
  tenant: Tenant | null | undefined,
): string[] {
  return tenant?.billingAccess?.enabledModules ?? [];
}
