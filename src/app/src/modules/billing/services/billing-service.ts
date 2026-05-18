import { apiClient, BASE_URL } from '@/shared/api/client';
import { triggerFileDownload } from '@/shared/lib/file-download';
import type {
  BillingPlan,
  BillingSubscriptionCatalog,
  TenantBillingAccess,
  UsageData,
} from '@/shared/types';

interface BackendUsageResponse {
  tenantId: string;
  plan: string;
  scheduledPlan?: string;
  currentPeriod: {
    start?: string;
    end?: string;
  };
  usage: {
    messages: { used: number; quota: number };
    aiTokens: { used: number; quota: number };
    contacts: { used: number; quota: number };
  };
}

interface BackendPlansResponse {
  tenantId: string;
  plans: BillingPlan[];
}

interface BackendSubscriptionCatalogResponse extends BillingSubscriptionCatalog {}

export interface AddonPackageInfo {
  tenantId: string;
  available: boolean;
  active: boolean;
  package: {
    messages: number;
    aiTokens: number;
    contacts: number;
    price: number;
  } | null;
}

export interface PurchaseAddonPackageResult {
  tenantId: string;
  package: {
    messages: number;
    aiTokens: number;
    contacts: number;
    price: number;
  };
  mode: 'CHECKOUT_REQUIRED';
  checkoutUrl: string;
}

function mapUsageData(input: BackendUsageResponse): UsageData {
  return {
    tenantId: input.tenantId,
    plan: input.plan,
    scheduledPlan: input.scheduledPlan,
    billingCycle: {
      start: input.currentPeriod.start ?? '',
      end: input.currentPeriod.end ?? '',
    },
    messages: input.usage.messages,
    aiTokens: input.usage.aiTokens,
    contacts: input.usage.contacts,
  };
}

export const billingService = {
  async getUsage(tenantId: string): Promise<UsageData> {
    const response = await apiClient.get<BackendUsageResponse>(`/tenants/${tenantId}/usage`);
    return mapUsageData(response);
  },

  downloadUsageExportCsv(tenantId: string, fallbackFileName = 'uso-periodo-atual.csv'): void {
    triggerFileDownload(`${BASE_URL}/tenants/${tenantId}/usage/export.csv`, fallbackFileName);
  },

  async listPlans(tenantId: string): Promise<BillingPlan[]> {
    const response = await apiClient.get<BackendPlansResponse>(
      `/tenants/${tenantId}/subscription/plans`,
    );
    return response.plans;
  },

  async changePlan(
    tenantId: string,
    targetPlan: 'ESSENCIAL' | 'PROFISSIONAL' | 'ESCALA',
    billingCycle?: 'MONTHLY' | 'YEARLY',
  ): Promise<{
    tenantId: string;
    plan: string;
    currentPlan: string;
    targetPlan: string;
    status: string;
    mode: 'NO_CHANGE' | 'CHECKOUT_REQUIRED' | 'DOWNGRADE_SCHEDULED';
    checkoutUrl?: string;
    effectiveAt?: string;
    billingCycle?: string;
  }> {
    return apiClient.patch(`/tenants/${tenantId}/subscription/plan`, {
      targetPlan,
      billingCycle,
    });
  },

  async cancelSubscription(
    tenantId: string,
  ): Promise<{ tenantId: string; status: string }> {
    return apiClient.post(`/tenants/${tenantId}/subscription/cancel`);
  },

  async getSubscriptionCatalog(
    tenantId: string,
  ): Promise<BillingSubscriptionCatalog> {
    return apiClient.get<BackendSubscriptionCatalogResponse>(
      `/tenants/${tenantId}/subscription/catalog`,
    );
  },

  async replaceSubscriptionModules(
    tenantId: string,
    moduleCodes: string[],
  ): Promise<{ tenantId: string; subscription: TenantBillingAccess }> {
    return apiClient.put(`/tenants/${tenantId}/subscription/modules`, {
      moduleCodes,
    });
  },

  async listPublicPlans(): Promise<BillingPlan[]> {
    const response = await apiClient.get<{ plans: BillingPlan[] }>('/public/billing/plans');
    const plans = response.plans ?? [];
    return plans
      .filter((plan) => plan.active)
      .sort((left, right) => left.sortOrder - right.sortOrder);
  },

  async getPublicNiches(): Promise<any[]> {
    const response = await apiClient.get<any>('/public/billing/niches');
    return response.niches || [];
  },

  async getPublicModules(): Promise<any[]> {
    const response = await apiClient.get<any>('/public/billing/modules');
    return response.modules || [];
  },

  async getAddonPackageInfo(tenantId: string): Promise<AddonPackageInfo> {
    return apiClient.get<AddonPackageInfo>(
      `/tenants/${tenantId}/subscription/addon-package`,
    );
  },

  async purchaseAddonPackage(tenantId: string): Promise<PurchaseAddonPackageResult> {
    return apiClient.post<PurchaseAddonPackageResult>(
      `/tenants/${tenantId}/subscription/addon-package`,
    );
  },

  async cancelAddonPackage(tenantId: string): Promise<{ tenantId: string; status: string }> {
    return apiClient.delete<{ tenantId: string; status: string }>(
      `/tenants/${tenantId}/subscription/addon-package`,
    );
  },
};
