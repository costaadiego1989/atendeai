import { platformAdminClient } from '@/shared/api/client';
import type {
  AdjustQuotasResponseDto,
  DraftMessageResponseDto,
  PlatformTenantsListDto,
} from '../types/platform-admin.types';

export interface ListPlatformTenantsInput {
  page: number;
  limit: number;
  /** Repassado à query string quando preenchido (ex.: `ListPlatformTenantsQueryDto` na API). */
  search?: string;
  plan?: string;
  tenantPlanStatus?: string;
  subscriptionStatus?: string;
}

export const platformAdminService = {
  listTenants(input: ListPlatformTenantsInput) {
    return platformAdminClient.get<PlatformTenantsListDto>('/platform/tenants', {
      page: input.page,
      limit: input.limit,
      ...(input.search?.trim() ? { search: input.search.trim() } : {}),
      ...(input.plan?.trim() ? { plan: input.plan.trim() } : {}),
      ...(input.tenantPlanStatus?.trim()
        ? { tenantPlanStatus: input.tenantPlanStatus.trim() }
        : {}),
      ...(input.subscriptionStatus?.trim()
        ? { subscriptionStatus: input.subscriptionStatus.trim() }
        : {}),
    });
  },

  patchTenantQuotas(
    tenantId: string,
    body: { messages?: number; aiTokens?: number; contacts?: number },
  ) {
    return platformAdminClient.patch<AdjustQuotasResponseDto>(
      `/platform/tenants/${tenantId}/quotas`,
      body,
    );
  },

  draftTenantMessage(
    tenantId: string,
    body: {
      intent: 'QUOTA_WARNING' | 'CUSTOM';
      tenantSummary: string;
      operatorHint?: string;
    },
  ) {
    return platformAdminClient.post<DraftMessageResponseDto>(
      `/platform/tenants/${tenantId}/messages/draft`,
      body,
    );
  },

  sendTenantManualMessage(tenantId: string, text: string) {
    return platformAdminClient.post<unknown>(`/platform/tenants/${tenantId}/messages/send`, {
      text,
    });
  },
};
