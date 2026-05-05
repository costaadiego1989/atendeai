import { apiClient } from '@/shared/api/client';
import type { TenantFinancialAccountStatus } from '@/shared/types';
import type { BootstrapTenantFinancialAccountInput } from './sales-types';

export const salesFinancialAccountService = {
  getTenantFinancialAccountStatus(tenantId: string): Promise<TenantFinancialAccountStatus> {
    return apiClient.get(`/tenants/${tenantId}/payment/account/status`);
  },

  bootstrapTenantFinancialAccount(
    tenantId: string,
    input: BootstrapTenantFinancialAccountInput,
  ): Promise<TenantFinancialAccountStatus> {
    return apiClient.post(`/tenants/${tenantId}/payment/account/bootstrap`, input);
  },
};
