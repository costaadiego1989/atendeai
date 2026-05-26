/**
 * Outbound port for tenant data needed by the billing module.
 * Billing uses this port to query/update tenant plan information
 * without directly importing tenant module internals.
 */
export interface ITenantQueryPort {
  findTenantById(tenantId: string): Promise<{
    plan: string;
    owner?: {
      name: string;
      email: string;
      phone: string;
    };
    cnpj?: string;
  } | null>;

  findTenantPlan(
    tenantId: string,
  ): Promise<{ plan: string; businessType?: string } | null>;

  updateTenantPlan(tenantId: string, plan: string): Promise<void>;
}

export const BILLING_TENANT_QUERY_PORT = Symbol('BILLING_TENANT_QUERY_PORT');
