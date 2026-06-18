import { apiClient } from '@/shared/api/client';
import { authenticatedDownload } from '@/shared/lib/file-download';
import type {
  CommerceAbandonmentTouch,
  CommerceCarrier,
  CommerceDeliverySchedule,
  CommerceOrder,
  CommerceOrderStatus,
  CommerceSession,
  CommerceShippingPolicy,
} from '@/shared/types';

export interface CheckoutOrderListItem extends CommerceOrder {
  contactName?: string | null;
  contactPhone?: string | null;
}

export interface CheckoutOrderDetails {
  order: CommerceOrder;
  session: CommerceSession | null;
  abandonmentTouches: CommerceAbandonmentTouch[];
}

export interface UpdateCheckoutShippingPolicyInput {
  mode: 'FIXED' | 'PER_KM';
  fixedAmount?: number | null;
  pricePerKm?: number | null;
  minimumAmount?: number | null;
  maxRadiusKm?: number | null;
  servicedNeighborhoods?: string[];
  deliverySchedule?: CommerceDeliverySchedule[];
  notes?: string | null;
  carrierShippingEnabled?: boolean;
}

export interface UpdateCheckoutAbandonmentStateInput {
  paused: boolean;
  userId?: string;
  userName?: string;
}

export interface TriggerCheckoutAbandonmentTouchInput {
  interval?: string;
  userId?: string;
  userName?: string;
}

export interface UpdateCheckoutOrderStatusInput {
  status: CommerceOrderStatus;
  userId?: string;
  userName?: string;
}

export interface CheckoutOrdersQueryParams {
  branchId?: string | null;
  status?: string;
  paymentStatus?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CheckoutAbandonmentConfig {
  id: string;
  tenantId: string;
  active: boolean;
  message: string | null;
  useAiMessage: boolean;
  mode: 'SINGLE' | 'QUEUE';
  maxTouches: number;
  intervalMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateCheckoutAbandonmentConfigInput {
  active: boolean;
  message?: string | null;
  useAiMessage: boolean;
  mode: 'SINGLE' | 'QUEUE';
  maxTouches: number;
  intervalMinutes: number;
}

export interface CheckoutCommerceSessionInput {
  billingType?: 'PIX' | 'UNDEFINED' | 'BOLETO' | 'CREDIT_CARD';
  paymentLinkName?: string;
  paymentLinkDescription?: string;
}

export interface CommerceCheckoutSessionResult {
  order: CommerceOrder;
  session: CommerceSession;
  paymentLink: {
    id: string;
    url: string;
    [key: string]: unknown;
  };
}

export interface StartCommerceSessionInput {
  conversationId: string;
  contactId?: string;
}

export interface AddCommerceSessionItemInput {
  catalogItemId?: string;
  inventoryItemId?: string;
  quantity: number;
}

export interface UpdateCommerceSessionFulfillmentInput {
  fulfillmentType: 'PICKUP' | 'DELIVERY';
  distanceKm?: number;
  deliveryAddress?: string;
  notes?: string;
}

export interface CommerceCatalogSearchOption {
  optionNumber: number;
  source: 'INVENTORY' | 'CATALOG';
  inventoryItemId?: string;
  catalogItemId?: string;
  name: string;
  price: number | null;
  currency: string;
  availableQuantity: number | null;
  availabilityStatus: string | null;
  categoryName: string | null;
  attributes?: unknown;
  variants?: unknown;
  optionGroups?: unknown;
}

export const checkoutService = {
  getShippingPolicy(tenantId: string): Promise<CommerceShippingPolicy | null> {
    return apiClient.get(`/tenants/${tenantId}/commerce/shipping-policy`);
  },

  updateShippingPolicy(
    tenantId: string,
    input: UpdateCheckoutShippingPolicyInput,
  ): Promise<CommerceShippingPolicy> {
    return apiClient.put(`/tenants/${tenantId}/commerce/shipping-policy`, input);
  },

  listOrders(
    tenantId: string,
    params?: CheckoutOrdersQueryParams,
  ): Promise<CheckoutOrderListItem[]> {
    return apiClient.get(`/tenants/${tenantId}/commerce/orders`, {
      branchId: params?.branchId || undefined,
      status: params?.status,
      paymentStatus: params?.paymentStatus,
      dateFrom: params?.dateFrom,
      dateTo: params?.dateTo,
    });
  },

  async downloadOrdersReport(
    tenantId: string,
    params?: CheckoutOrdersQueryParams,
  ): Promise<void> {
    const searchParams = new URLSearchParams();

    if (params?.branchId) searchParams.set('branchId', params.branchId);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.paymentStatus) searchParams.set('paymentStatus', params.paymentStatus);
    if (params?.dateFrom) searchParams.set('dateFrom', params.dateFrom);
    if (params?.dateTo) searchParams.set('dateTo', params.dateTo);

    const suffix = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return authenticatedDownload(
      `/tenants/${tenantId}/commerce/orders/report.csv${suffix}`,
      'checkout.csv',
    );
  },

  getOrderDetails(tenantId: string, orderId: string): Promise<CheckoutOrderDetails> {
    return apiClient.get(`/tenants/${tenantId}/commerce/orders/${orderId}`);
  },

  updateOrderStatus(
    tenantId: string,
    orderId: string,
    input: UpdateCheckoutOrderStatusInput,
  ): Promise<CommerceOrder> {
    return apiClient.put(`/tenants/${tenantId}/commerce/orders/${orderId}/status`, input);
  },

  updateAbandonmentState(
    tenantId: string,
    orderId: string,
    input: UpdateCheckoutAbandonmentStateInput,
  ) {
    return apiClient.put(`/tenants/${tenantId}/commerce/orders/${orderId}/abandonment`, input);
  },

  triggerAbandonmentTouch(
    tenantId: string,
    orderId: string,
    input: TriggerCheckoutAbandonmentTouchInput = {},
  ) {
    return apiClient.post(
      `/tenants/${tenantId}/commerce/orders/${orderId}/abandonment-touch`,
      input,
    );
  },

  getAbandonmentConfig(tenantId: string): Promise<CheckoutAbandonmentConfig | null> {
    return apiClient.get(`/tenants/${tenantId}/commerce/abandonment-config`);
  },

  updateAbandonmentConfig(
    tenantId: string,
    input: UpdateCheckoutAbandonmentConfigInput,
  ): Promise<CheckoutAbandonmentConfig> {
    return apiClient.put(`/tenants/${tenantId}/commerce/abandonment-config`, input);
  },

  searchCommerceCatalog(
    tenantId: string,
    query: string,
    limit?: number,
  ): Promise<CommerceCatalogSearchOption[]> {
    return apiClient.get(`/tenants/${tenantId}/commerce/catalog-search`, {
      query,
      ...(limit != null ? { limit: String(limit) } : {}),
    });
  },

  startCommerceSession(
    tenantId: string,
    input: StartCommerceSessionInput,
  ): Promise<CommerceSession> {
    return apiClient.post(`/tenants/${tenantId}/commerce/sessions`, input);
  },

  getCommerceSession(tenantId: string, sessionId: string): Promise<CommerceSession> {
    return apiClient.get(`/tenants/${tenantId}/commerce/sessions/${sessionId}`);
  },

  addCommerceSessionItem(
    tenantId: string,
    sessionId: string,
    input: AddCommerceSessionItemInput,
  ): Promise<CommerceSession> {
    return apiClient.post(`/tenants/${tenantId}/commerce/sessions/${sessionId}/items`, input);
  },

  updateCommerceSessionFulfillment(
    tenantId: string,
    sessionId: string,
    input: UpdateCommerceSessionFulfillmentInput,
  ): Promise<CommerceSession> {
    return apiClient.put(`/tenants/${tenantId}/commerce/sessions/${sessionId}/fulfillment`, input);
  },

  applyCommerceSessionCoupon(
    tenantId: string,
    sessionId: string,
    code: string,
  ): Promise<CommerceSession> {
    return apiClient.post(`/tenants/${tenantId}/commerce/sessions/${sessionId}/coupon`, { code });
  },

  checkoutCommerceSession(
    tenantId: string,
    sessionId: string,
    input?: CheckoutCommerceSessionInput,
  ): Promise<CommerceCheckoutSessionResult> {
    return apiClient.post(
      `/tenants/${tenantId}/commerce/sessions/${sessionId}/checkout`,
      input ?? {},
    );
  },

  generateAbandonmentMessage(tenantId: string): Promise<{ message: string }> {
    return apiClient.post(`/tenants/${tenantId}/commerce/abandonment-config/generate-message`, {});
  },

  getOrderTracking(
    tenantId: string,
    orderId: string,
  ): Promise<OrderTrackingInfo> {
    return apiClient.get(`/tenants/${tenantId}/commerce/orders/${orderId}/tracking`);
  },

  setOrderTracking(
    tenantId: string,
    orderId: string,
    input: SetOrderTrackingInput,
  ): Promise<CommerceOrder> {
    return apiClient.put(`/tenants/${tenantId}/commerce/orders/${orderId}/tracking`, input);
  },
};

export interface OrderTrackingInfo {
  orderId: string;
  status: CommerceOrderStatus;
  trackingCode: string | null;
  trackingUrl: string | null;
  trackingNotifiedAt: string | null;
  carrier: CommerceCarrier | null;
}

export interface SetOrderTrackingInput {
  trackingCode: string;
  trackingUrl?: string;
  carrier?: CommerceCarrier;
}
