import { useQuery } from "@tanstack/react-query";
import { adminFetch } from "./adminApi";

type Period = "1d" | "7d" | "30d" | "90d";

interface PeriodParams {
  period?: Period;
  tenantId?: string;
}

interface PaginatedParams extends PeriodParams {
  page?: number;
  limit?: number;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  });
  const str = qs.toString();
  return str ? `?${str}` : "";
}

// Dashboard
export function useDashboardOverview(params: PeriodParams) {
  return useQuery({
    queryKey: ["platform-dashboard", params],
    queryFn: () => adminFetch(`/platform/dashboard/overview${buildQuery(params)}`),
  });
}

// Tenants
export function useTenantsMetrics(params: PeriodParams) {
  return useQuery({
    queryKey: ["platform-tenants-metrics", params],
    queryFn: () => adminFetch(`/platform/tenants/metrics${buildQuery(params)}`),
  });
}

export function useTenantDetail(tenantId: string) {
  return useQuery({
    queryKey: ["platform-tenant-detail", tenantId],
    queryFn: () => adminFetch(`/platform/tenants/${tenantId}/details`),
    enabled: !!tenantId,
  });
}

// Billing
export function useBillingMetrics(params: PeriodParams) {
  return useQuery({
    queryKey: ["platform-billing-metrics", params],
    queryFn: () => adminFetch(`/platform/billing/metrics${buildQuery(params)}`),
  });
}

export function useBillingSubscriptions(params: PaginatedParams & { subscriptionStatus?: string; billingCycleType?: string; plan?: string }) {
  return useQuery({
    queryKey: ["platform-billing-subscriptions", params],
    queryFn: () => adminFetch(`/platform/billing/subscriptions${buildQuery(params)}`),
  });
}

export function useBillingUsage(params: PaginatedParams) {
  return useQuery({
    queryKey: ["platform-billing-usage", params],
    queryFn: () => adminFetch(`/platform/billing/usage${buildQuery(params)}`),
  });
}

// Messaging
export function useMessagingMetrics(params: PeriodParams) {
  return useQuery({
    queryKey: ["platform-messaging-metrics", params],
    queryFn: () => adminFetch(`/platform/messaging/metrics${buildQuery(params)}`),
  });
}

export function useMessagingConversations(params: PaginatedParams & { channel?: string; status?: string; contactSearch?: string }) {
  return useQuery({
    queryKey: ["platform-messaging-conversations", params],
    queryFn: () => adminFetch(`/platform/messaging/conversations${buildQuery(params)}`),
  });
}

// Sales
export function useSalesMetrics(params: PeriodParams) {
  return useQuery({
    queryKey: ["platform-sales-metrics", params],
    queryFn: () => adminFetch(`/platform/sales/metrics${buildQuery(params)}`),
  });
}

export function useSalesPaymentLinks(params: PaginatedParams & { status?: string; billingType?: string }) {
  return useQuery({
    queryKey: ["platform-sales-payment-links", params],
    queryFn: () => adminFetch(`/platform/sales/payment-links${buildQuery(params)}`),
  });
}

// Commerce
export function useCommerceMetrics(params: PeriodParams) {
  return useQuery({
    queryKey: ["platform-commerce-metrics", params],
    queryFn: () => adminFetch(`/platform/commerce/metrics${buildQuery(params)}`),
  });
}

// Recovery
export function useRecoveryMetrics(params: PeriodParams) {
  return useQuery({
    queryKey: ["platform-recovery-metrics", params],
    queryFn: () => adminFetch(`/platform/recovery/metrics${buildQuery(params)}`),
  });
}

export function useRecoveryCases(params: PaginatedParams & { status?: string; source?: string }) {
  return useQuery({
    queryKey: ["platform-recovery-cases", params],
    queryFn: () => adminFetch(`/platform/recovery/cases${buildQuery(params)}`),
  });
}

// Contacts
export function useContactsMetrics(params: PeriodParams) {
  return useQuery({
    queryKey: ["platform-contacts-metrics", params],
    queryFn: () => adminFetch(`/platform/contacts/metrics${buildQuery(params)}`),
  });
}

export function useContactsList(params: PaginatedParams & { stage?: string; search?: string }) {
  return useQuery({
    queryKey: ["platform-contacts-list", params],
    queryFn: () => adminFetch(`/platform/contacts${buildQuery(params)}`),
  });
}

// Prospecting
export function useProspectingMetrics(params: PeriodParams) {
  return useQuery({
    queryKey: ["platform-prospecting-metrics", params],
    queryFn: () => adminFetch(`/platform/prospecting/metrics${buildQuery(params)}`),
  });
}

export function useProspectingCampaigns(params: PaginatedParams & { status?: string }) {
  return useQuery({
    queryKey: ["platform-prospecting-campaigns", params],
    queryFn: () => adminFetch(`/platform/prospecting/campaigns${buildQuery(params)}`),
  });
}

// Scheduling
export function useSchedulingMetrics(params: PeriodParams) {
  return useQuery({
    queryKey: ["platform-scheduling-metrics", params],
    queryFn: () => adminFetch(`/platform/scheduling/metrics${buildQuery(params)}`),
  });
}

export function useSchedulingReservations(params: PaginatedParams & { status?: string }) {
  return useQuery({
    queryKey: ["platform-scheduling-reservations", params],
    queryFn: () => adminFetch(`/platform/scheduling/reservations${buildQuery(params)}`),
  });
}

// AI
export function useAIMetrics(params: PeriodParams) {
  return useQuery({
    queryKey: ["platform-ai-metrics", params],
    queryFn: () => adminFetch(`/platform/ai/metrics${buildQuery(params)}`),
  });
}

export function useAISessions(params: PaginatedParams & { intent?: string; sentiment?: string }) {
  return useQuery({
    queryKey: ["platform-ai-sessions", params],
    queryFn: () => adminFetch(`/platform/ai/sessions${buildQuery(params)}`),
  });
}

// Social
export function useSocialMetrics(params: PeriodParams) {
  return useQuery({
    queryKey: ["platform-social-metrics", params],
    queryFn: () => adminFetch(`/platform/social/metrics${buildQuery(params)}`),
  });
}

// Catalog
export function useCatalogMetrics(params: { tenantId?: string }) {
  return useQuery({
    queryKey: ["platform-catalog-metrics", params],
    queryFn: () => adminFetch(`/platform/catalog/metrics${buildQuery(params)}`),
  });
}

// Inventory
export function useInventoryMetrics(params: { tenantId?: string }) {
  return useQuery({
    queryKey: ["platform-inventory-metrics", params],
    queryFn: () => adminFetch(`/platform/inventory/metrics${buildQuery(params)}`),
  });
}

// Support
export function useSupportMetrics(params: PeriodParams) {
  return useQuery({
    queryKey: ["platform-support-metrics", params],
    queryFn: () => adminFetch(`/platform/support/metrics${buildQuery(params)}`),
  });
}

// Auth
export function useAuthMetrics(params: PeriodParams) {
  return useQuery({
    queryKey: ["platform-auth-metrics", params],
    queryFn: () => adminFetch(`/platform/auth/metrics${buildQuery(params)}`),
  });
}

// Payment
export function usePaymentMetrics(params: PeriodParams) {
  return useQuery({
    queryKey: ["platform-payment-metrics", params],
    queryFn: () => adminFetch(`/platform/payment/metrics${buildQuery(params)}`),
  });
}

// Proposals
export function useProposalMetrics(params: PeriodParams) {
  return useQuery({
    queryKey: ["platform-proposal-metrics", params],
    queryFn: () => adminFetch(`/platform/proposals/metrics${buildQuery(params)}`),
  });
}
