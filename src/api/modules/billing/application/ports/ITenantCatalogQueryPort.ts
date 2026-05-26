/**
 * Outbound port for tenant catalog/business-type data needed by the billing module.
 * Billing uses this port to query tenant business type for catalog resolution
 * without directly injecting PrismaService in use cases.
 */
export interface ITenantCatalogQueryPort {
  findTenantBusinessType(tenantId: string): Promise<string | null>;
}

export const BILLING_TENANT_CATALOG_PORT = Symbol(
  'BILLING_TENANT_CATALOG_PORT',
);
