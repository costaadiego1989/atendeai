export type CommerceShippingMode = 'FIXED' | 'PER_KM' | 'CARRIER';
export type CommerceFulfillmentType = 'PICKUP' | 'DELIVERY';
export type CommerceDeliveryWeekday =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';
export type CommerceConversationStep =
  | 'IDENTIFYING_NEED'
  | 'SELECTING_ITEM'
  | 'AWAITING_QUANTITY'
  | 'ASKING_MORE_ITEMS'
  | 'AWAITING_FULFILLMENT'
  | 'AWAITING_SHIPPING_METHOD'
  | 'AWAITING_CARRIER_CEP'
  | 'AWAITING_CARRIER_OPTION'
  | 'AWAITING_DELIVERY_ADDRESS'
  | 'AWAITING_FREIGHT_REVIEW'
  | 'AWAITING_ORDER_NOTE'
  | 'READY_FOR_CHECKOUT'
  | 'AWAITING_PAYMENT'
  | 'PAID'
  | 'CANCELLED';
export type CommerceSessionStatus =
  | 'BUILDING_CART'
  | 'READY_FOR_CHECKOUT'
  | 'AWAITING_PAYMENT'
  | 'PAID'
  | 'CANCELLED';
export type CommerceOrderStatus =
  | 'AWAITING_PAYMENT'
  | 'PAID'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export type CommerceCarrier = 'CORREIOS' | 'JADLOG' | 'MELHOR_ENVIO' | 'OTHER';

export interface CommerceShippingPolicyRecord {
  tenantId: string;
  mode: CommerceShippingMode;
  fixedAmount: number | null;
  pricePerKm: number | null;
  minimumAmount: number | null;
  maxRadiusKm: number | null;
  servicedNeighborhoods: string[];
  deliverySchedule: CommerceDeliveryScheduleRecord[];
  notes: string | null;
  active: boolean;
  carrierShippingEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommerceDeliveryScheduleRecord {
  weekday: CommerceDeliveryWeekday;
  enabled: boolean;
  startTime: string | null;
  endTime: string | null;
}

export interface CommerceSessionItemRecord {
  id: string;
  sessionId: string;
  tenantId: string;
  source: 'INVENTORY' | 'CATALOG';
  inventoryItemId: string | null;
  catalogItemId: string | null;
  name: string;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommercePendingOptionRecord {
  optionNumber: number;
  source: 'INVENTORY' | 'CATALOG';
  inventoryItemId?: string;
  catalogItemId?: string;
  name: string;
  price?: number | null;
  currency?: string;
  availableQuantity?: number | null;
  availabilityStatus?: string | null;
  categoryName?: string | null;
  attributes?: Record<string, unknown>;
  variants?: Array<Record<string, unknown>>;
  optionGroups?: Array<Record<string, unknown>>;
}

export interface CommerceSessionWarning {
  type: 'COUPON_APPLICATION_FAILED';
  code: string;
  message: string;
}

export interface CommerceSessionRecord {
  id: string;
  tenantId: string;
  branchId: string | null;
  conversationId: string;
  contactId: string | null;
  status: CommerceSessionStatus;
  currentStep: CommerceConversationStep;
  fulfillmentType: CommerceFulfillmentType | null;
  shippingMode: CommerceShippingMode | null;
  distanceKm: number | null;
  freightAmount: number | null;
  subtotalAmount: number;
  totalAmount: number;
  deliveryAddress: string | null;
  notes: string | null;
  paymentReference: string | null;
  paymentLinkId: string | null;
  paymentLinkUrl: string | null;
  paymentStatus: 'PENDING' | 'PAID' | null;
  abandonmentPaused: boolean;
  abandonmentPausedAt: Date | null;
  pendingQuery: string | null;
  pendingOptions: CommercePendingOptionRecord[];
  selectedSource: 'INVENTORY' | 'CATALOG' | null;
  selectedInventoryItemId: string | null;
  selectedCatalogItemId: string | null;
  selectedItemName: string | null;
  carrierCep: string | null;
  carrierServiceCode: string | null;
  carrierServiceName: string | null;
  carrierDeliveryDays: number | null;
  checkedOutAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items: CommerceSessionItemRecord[];
  couponCode: string | null;
  discountAmount: number | null;
  warning?: CommerceSessionWarning;
}

export interface CommerceOrderRecord {
  id: string;
  tenantId: string;
  branchId: string | null;
  sessionId: string;
  conversationId: string;
  contactId: string | null;
  status: CommerceOrderStatus;
  fulfillmentType: CommerceFulfillmentType | null;
  shippingMode: CommerceShippingMode | null;
  subtotalAmount: number;
  freightAmount: number;
  totalAmount: number;
  deliveryAddress: string | null;
  paymentReference: string | null;
  paymentLinkId: string | null;
  paymentLinkUrl: string | null;
  couponCode: string | null;
  discountAmount: number | null;
  paymentStatus: 'PENDING' | 'PAID' | null;
  paidAt: Date | null;
  trackingCode: string | null;
  trackingUrl: string | null;
  trackingNotifiedAt: Date | null;
  carrier: CommerceCarrier | null;
  carrierServiceName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommerceAbandonmentConfigRecord {
  id: string;
  tenantId: string;
  active: boolean;
  message: string | null;
  useAiMessage: boolean;
  mode: 'SINGLE' | 'QUEUE';
  maxTouches: number;
  intervalMinutes: number;
  minimumIntervalMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommerceAbandonmentTouchRecord {
  interval: string;
  triggeredAt: Date;
  subtotalAmount?: number | null;
  totalAmount?: number | null;
  currentStep?: string | null;
}

export interface CommerceOrderListItemRecord extends CommerceOrderRecord {
  contactName: string | null;
  contactPhone: string | null;
  abandonmentTouchesCount?: number;
  lastAbandonmentInterval?: string | null;
  lastAbandonmentAt?: Date | null;
}

export interface CommerceCatalogLookupreçord {
  id: string;
  tenantId: string;
  name: string;
  basePrice: number | null;
  currency: string;
  categoryName: string | null;
}

export interface CommerceInventoryLookupreçord {
  id: string;
  tenantId: string;
  catalogItemId: string | null;
  name: string;
  currentPrice: number | null;
  currency: string;
  availableQuantity: number;
  availabilityStatus: string;
}

export interface UpsertCommerceShippingPolicyInput {
  tenantId: string;
  mode: CommerceShippingMode;
  fixedAmount?: number | null;
  pricePerKm?: number | null;
  minimumAmount?: number | null;
  maxRadiusKm?: number | null;
  servicedNeighborhoods?: string[] | null;
  deliverySchedule?: CommerceDeliveryScheduleRecord[] | null;
  notes?: string | null;
  active: boolean;
  carrierShippingEnabled?: boolean;
}

export interface UpsertCommerceAbandonmentConfigInput {
  tenantId: string;
  active: boolean;
  message?: string | null;
  useAiMessage: boolean;
  mode: 'SINGLE' | 'QUEUE';
  maxTouches: number;
  intervalMinutes: number;
}

export interface CreateCommerceSessionInput {
  tenantId: string;
  branchId?: string | null;
  conversationId: string;
  contactId?: string | null;
}

export interface AddCommerceSessionItemInput {
  sessionId: string;
  tenantId: string;
  source: 'INVENTORY' | 'CATALOG';
  inventoryItemId?: string | null;
  catalogItemId?: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  currency?: string;
}

export interface UpdateCommerceSessionStateInput {
  tenantId: string;
  sessionId: string;
  status?: CommerceSessionStatus;
  currentStep?: CommerceConversationStep | null;
  fulfillmentType?: CommerceFulfillmentType | null;
  shippingMode?: CommerceShippingMode | null;
  distanceKm?: number | null;
  freightAmount?: number | null;
  subtotalAmount?: number;
  totalAmount?: number;
  deliveryAddress?: string | null;
  notes?: string | null;
  paymentReference?: string | null;
  paymentLinkId?: string | null;
  paymentLinkUrl?: string | null;
  paymentStatus?: 'PENDING' | 'PAID' | null;
  abandonmentPaused?: boolean;
  abandonmentPausedAt?: Date | null;
  pendingQuery?: string | null;
  pendingOptions?: CommercePendingOptionRecord[] | null;
  selectedSource?: 'INVENTORY' | 'CATALOG' | null;
  selectedInventoryItemId?: string | null;
  selectedCatalogItemId?: string | null;
  selectedItemName?: string | null;
  carrierCep?: string | null;
  carrierServiceCode?: string | null;
  carrierServiceName?: string | null;
  carrierDeliveryDays?: number | null;
  checkedOutAt?: Date | null;
  couponCode?: string | null;
  discountAmount?: number | null;
}

export interface CreateCommerceOrderInput {
  id: string;
  tenantId: string;
  branchId?: string | null;
  sessionId: string;
  conversationId: string;
  contactId?: string | null;
  status: CommerceOrderStatus;
  fulfillmentType?: CommerceFulfillmentType | null;
  shippingMode?: CommerceShippingMode | null;
  subtotalAmount: number;
  freightAmount: number;
  totalAmount: number;
  deliveryAddress?: string | null;
  paymentReference?: string | null;
  paymentLinkId?: string | null;
  paymentLinkUrl?: string | null;
  paymentStatus?: 'PENDING' | 'PAID' | null;
  couponCode?: string | null;
  discountAmount?: number | null;
  carrierServiceName?: string | null;
}

export interface CommerceAuditLogInput {
  tenantId: string;
  userId?: string;
  userName?: string;
  event: string;
  entityId: string;
  entityType: 'SESSION' | 'ORDER' | 'SHIPPING_POLICY';
  metadata?: Record<string, any>;
}

export interface MarkCommerceOrderPaidInput {
  tenantId: string;
  paymentReference: string;
  paidAt: Date;
}

export interface UpdateOrderTrackingInput {
  tenantId: string;
  orderId: string;
  trackingCode: string;
  trackingUrl?: string | null;
  carrier?: CommerceCarrier | null;
}

export interface ListAbandonedCommerceSessionsInput {
  interval: string;
  staleBefore: Date;
  limit?: number;
}

export interface ICommerceRepository {
  saveAuditLog(input: CommerceAuditLogInput): Promise<void>;
  upsertShippingPolicy(
    input: UpsertCommerceShippingPolicyInput,
  ): Promise<CommerceShippingPolicyRecord>;
  findShippingPolicyByTenantId(
    tenantId: string,
  ): Promise<CommerceShippingPolicyRecord | null>;
  upsertAbandonmentConfig(
    input: UpsertCommerceAbandonmentConfigInput,
  ): Promise<CommerceAbandonmentConfigRecord>;
  findAbandonmentConfigByTenantId(
    tenantId: string,
  ): Promise<CommerceAbandonmentConfigRecord | null>;
  createSession(
    input: CreateCommerceSessionInput,
  ): Promise<CommerceSessionRecord>;
  findActiveSessionByConversation(
    tenantId: string,
    conversationId: string,
  ): Promise<CommerceSessionRecord | null>;
  findSessionById(
    tenantId: string,
    sessionId: string,
  ): Promise<CommerceSessionRecord | null>;
  addSessionItem(
    input: AddCommerceSessionItemInput,
  ): Promise<CommerceSessionItemRecord>;
  updateSessionState(
    input: UpdateCommerceSessionStateInput,
  ): Promise<CommerceSessionRecord>;
  createOrder(input: CreateCommerceOrderInput): Promise<CommerceOrderRecord>;
  findOrderById(
    tenantId: string,
    orderId: string,
  ): Promise<CommerceOrderRecord | null>;
  findOrderByPaymentReference(
    tenantId: string,
    paymentReference: string,
  ): Promise<CommerceOrderRecord | null>;
  listOrders(input: {
    tenantId: string;
    branchId?: string | null;
    status?: string | null;
    paymentStatus?: string | null;
    dateFrom?: Date | null;
    dateTo?: Date | null;
  }): Promise<CommerceOrderListItemRecord[]>;
  updateOrderStatus(input: {
    tenantId: string;
    orderId: string;
    status: CommerceOrderStatus;
  }): Promise<CommerceOrderRecord>;
  updateOrderPaymentLink(input: {
    tenantId: string;
    orderId: string;
    paymentLinkId: string;
    paymentLinkUrl: string;
  }): Promise<CommerceOrderRecord>;
  markOrderPaidByPaymentReference(
    input: MarkCommerceOrderPaidInput,
  ): Promise<CommerceOrderRecord | null>;
  updateOrderTracking(
    input: UpdateOrderTrackingInput,
  ): Promise<CommerceOrderRecord>;
  findOrdersByContact(
    tenantId: string,
    contactId: string,
    limit?: number,
  ): Promise<CommerceOrderRecord[]>;
  listAbandonedSessions(
    input: ListAbandonedCommerceSessionsInput,
  ): Promise<CommerceSessionRecord[]>;
  listSessionAbandonmentTouches(
    tenantId: string,
    sessionId: string,
  ): Promise<CommerceAbandonmentTouchRecord[]>;
  findCatalogItemById(
    tenantId: string,
    itemId: string,
  ): Promise<CommerceCatalogLookupreçord | null>;
  findInventoryItemById(
    tenantId: string,
    itemId: string,
  ): Promise<CommerceInventoryLookupreçord | null>;
  countActiveCatalogItems(tenantId: string): Promise<number>;
}

export const COMMERCE_REPOSITORY = Symbol('COMMERCE_REPOSITORY');
