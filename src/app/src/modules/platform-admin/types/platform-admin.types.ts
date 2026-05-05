export interface PlatformTenantSubscriptionDto {
  plan: string;
  status: string;
  subscribedAt: string;
  cycleStart: string;
  cycleEnd: string;
}

export interface PlatformTenantOverviewItemDto {
  tenantId: string;
  companyName: string;
  cnpj: string;
  tenantPlan: string;
  tenantPlanStatus: string;
  tenantCreatedAt: string;
  subscription: PlatformTenantSubscriptionDto | null;
  quotas: {
    messages: { limit: number };
    aiTokens: { limit: number };
    contacts: { limit: number };
  };
  usage: {
    messages: { used: number };
    aiTokens: { used: number };
    contacts: { used: number };
    periodStart: string | null;
    periodEnd: string | null;
  };
}

export interface AdjustQuotasResponseDto {
  tenantId: string;
  quotas: { messages: number; aiTokens: number; contacts: number };
}

export interface DraftMessageResponseDto {
  text: string;
}

export interface PlatformTenantsListDto {
  items: PlatformTenantOverviewItemDto[];
  total: number;
  totalPages: number;
  page?: number;
  limit?: number;
}
