import type { Tenant } from '@/shared/types';

export function hasTenantModuleAccess(
  tenant: Tenant | null | undefined,
  moduleCode: string,
): boolean {
  if (!tenant || !moduleCode) {
    return false;
  }

  const access = tenant.billingAccess?.moduleAccess;

  // If moduleAccess is not configured or empty, allow access (permissive fallback).
  // This covers tenants without a subscription or without billing modules set up.
  if (!access || Object.keys(access).length === 0) {
    return true;
  }

  return Boolean(access[moduleCode]);
}

export function getTenantEnabledModules(
  tenant: Tenant | null | undefined,
): string[] {
  return tenant?.billingAccess?.enabledModules ?? [];
}
