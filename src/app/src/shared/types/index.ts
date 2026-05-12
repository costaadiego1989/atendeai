export interface User {
  id: string;
  email: string;
  name: string;
  role: 'OWNER' | 'ADMIN' | 'AGENT';
  tenantId: string;
  accessibleBranchIds?: string[];
  phone?: string;
  cpf?: string;
  mustChangePassword?: boolean;
  avatarUrl?: string;
}

export interface AuthSession {
  user: User;
  tenant: Tenant;
  activeBranchId?: string | null;
}

export type BusinessType =
  | 'RETAIL'
  | 'ECOMMERCE'
  | 'HEALTH'
  | 'BEAUTY'
  | 'LEGAL'
  | 'REALESTATE'
  | 'FOOD'
  | 'AGENCY'
  | 'GYM'
  | 'EDUCATION'
  | 'PET'
  | 'AUTOMOTIVE'
  | 'HOME_SERV'
  | 'HOSPITALITY'
  | 'SUPERMARKET'
  | 'MARKET'
  | 'GROCERY'
  | 'BAKERY'
  | 'CAFETERIA'
  | 'SIMPLE_SERVICE'
  | 'SCHEDULING'
  | 'CLINIC'
  | 'RECOVERY'
  | 'RENTAL'
  | 'OTHER';

export type CommerceShippingMode = 'FIXED' | 'PER_KM';
export type CommerceFulfillmentType = 'PICKUP' | 'DELIVERY';
export type CommerceDeliveryWeekday =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';
export type CommerceSessionStatus =
  | 'BUILDING_CART'
  | 'READY_FOR_CHECKOUT'
  | 'AWAITING_PAYMENT'
  | 'PAID'
  | 'CANCELLED';
export type CommerceConversationStep =
  | 'IDENTIFYING_NEED'
  | 'SELECTING_ITEM'
  | 'AWAITING_QUANTITY'
  | 'ASKING_MORE_ITEMS'
  | 'AWAITING_FULFILLMENT'
  | 'AWAITING_DELIVERY_ADDRESS'
  | 'AWAITING_FREIGHT_REVIEW'
  | 'AWAITING_ORDER_NOTE'
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

export interface CommerceDeliverySchedule {
  weekday: CommerceDeliveryWeekday;
  enabled: boolean;
  startTime?: string | null;
  endTime?: string | null;
}

export interface CommerceShippingPolicy {
  tenantId: string;
  mode: CommerceShippingMode;
  fixedAmount?: number | null;
  pricePerKm?: number | null;
  minimumAmount?: number | null;
  maxRadiusKm?: number | null;
  servicedNeighborhoods?: string[];
  deliverySchedule?: CommerceDeliverySchedule[];
  notes?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommerceCatalogOption {
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
}

export interface CommerceSessionItem {
  id: string;
  sessionId: string;
  source: 'INVENTORY' | 'CATALOG';
  inventoryItemId?: string | null;
  catalogItemId?: string | null;
  name: string;
  quantity: number;
  unitPrice?: number | null;
  lineTotal: number;
  currency: string;
}

export interface CommerceSession {
  id: string;
  tenantId: string;
  conversationId: string;
  contactId?: string | null;
  status: CommerceSessionStatus;
  currentStep?: CommerceConversationStep;
  fulfillmentType?: CommerceFulfillmentType | null;
  shippingMode?: CommerceShippingMode | null;
  distanceKm?: number | null;
  freightAmount?: number | null;
  subtotalAmount: number;
  totalAmount: number;
  deliveryAddress?: string | null;
  notes?: string | null;
  paymentReference?: string | null;
  paymentLinkId?: string | null;
  paymentLinkUrl?: string | null;
  paymentStatus?: 'PENDING' | 'PAID' | null;
  abandonmentPaused?: boolean;
  abandonmentPausedAt?: string | null;
  checkedOutAt?: string | null;
  createdAt: string;
  updatedAt: string;
  items: CommerceSessionItem[];
}

export interface CommerceOrder {
  id: string;
  tenantId: string;
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
  paidAt?: string | null;
  abandonmentTouchesCount?: number;
  lastAbandonmentInterval?: string | null;
  lastAbandonmentAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommerceAbandonmentTouch {
  interval: string;
  triggeredAt: string;
  subtotalAmount?: number | null;
  totalAmount?: number | null;
  currentStep?: string | null;
}

export interface TenantOwner {
  name: string;
  email: string;
  phone?: string | null;
  cpf?: string | null;
  birthDate?: string | null;
}

export interface TenantBranch {
  id: string;
  name: string;
  cnpj?: string | null;
  phone?: string | null;
  email?: string | null;
  whatsappNumber?: string | null;
  instagramAccountId?: string | null;
  whatsAppConfigOverride?: {
    provider: 'BUBBLEWHATS' | 'TWILIO' | 'D360';
    credentials: Record<string, string>;
    webhookSecret?: string | null;
  } | null;
  zipcode?: string;
  street?: string;
  streetNumber?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  operatingHours?: OperatingHours | null;
  isHeadquarters: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TenantBillingAccess {
  subscriptionId?: string | null;
  plan?: string | null;
  status?: string | null;
  pricing: {
    baseMonthlyPrice: number;
    addonsMonthlyPrice: number;
    totalMonthlyPrice: number;
    pricingVersion?: string | null;
  };
  includedModules: string[];
  addonModules: string[];
  enabledModules: string[];
  moduleAccess: Record<string, boolean>;
}

export interface OperatingHoursDay {
  open: string;
  close: string;
  closed?: boolean;
}

export type OperatingHours = Record<string, OperatingHoursDay>;

export interface Tenant {
  id: string;
  name: string;
  segment?: string;
  logoUrl?: string;
  phone?: string;
  email?: string;
  address?: string;
  cnpj?: string;
  plan?: string;
  businessType?: BusinessType | string;
  billingAccess?: TenantBillingAccess;
  description?: string;
  services?: string;
  catalogUrl?: string;
  catalogFiles?: string[];
  zipcode?: string;
  street?: string;
  streetNumber?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  operatingHours?: OperatingHours;
  owner?: TenantOwner;
  branches?: TenantBranch[];
  defaultBranchId?: string | null;
  channels?: {
    whatsapp?: {
      configured: boolean;
      connected: boolean;
      provider?: string | null;
      status?: string | null;
      whatsappNumber?: string | null;
    };
    instagram?: {
      configured: boolean;
      connected: boolean;
      status?: string | null;
      instagramAccountId?: string | null;
    };
  };
  supportMeta?: {
    tenantId: string;
    plan: string;
    planStatus: string;
    createdAt: string;
  };
  recentAuditLogs?: Array<{
    id: string;
    eventType: string;
    email?: string | null;
    createdAt: string;
    metadata?: Record<string, unknown>;
  }>;
  aiConfig?: AIConfig;
  promotions?: Promotion[];
  planStatus?: string;
  createdAt: string;
}

export interface BusinessData {
  description?: string;
  segment?: string;
  openingHours?: string;
  address?: string;
  website?: string;
  catalogItems?: CatalogItem[];
}

export interface CatalogItem {
  id?: string;
  name: string;
  description?: string;
  price?: number;
  category?: string;
  type?: 'PRODUCT' | 'SERVICE' | 'RENTAL';
  basePrice?: number;
  currency?: string;
  active?: boolean;
  source?: 'MANUAL' | 'IMPORT' | 'ERP_SNAPSHOT';
  categoryId?: string;
  categoryName?: string;
  categoryPath?: string[];
  tags?: string[];
  externalReference?: string;
  imageUrl?: string;
  attributes?: Record<string, unknown>;
  variants?: Array<Record<string, unknown>>;
  optionGroups?: Array<Record<string, unknown>>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CatalogCategory {
  id: string;
  name: string;
  description?: string;
  active?: boolean;
  source?: 'MANUAL' | 'IMPORT' | 'ERP_SNAPSHOT';
  itemsCount?: number;
  parentCategoryId?: string;
  parentCategoryName?: string;
  path?: string[];
  level?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type CatalogAsyncJobType = 'EXPORT_CATALOG_REPORT_CSV' | 'IMPORT_CATALOG_ITEMS';
export type CatalogAsyncJobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface CatalogAsyncJob {
  id: string;
  tenantId: string;
  type: CatalogAsyncJobType;
  status: CatalogAsyncJobStatus;
  requestedByUserId?: string | null;
  requestedByUserEmail?: string | null;
  progress: number;
  totalItems: number;
  processedItems: number;
  resultSummary?: Record<string, unknown> & {
    totalRows?: number;
    processed?: number;
    totalItems?: number;
    created?: number;
    updated?: number;
    skipped?: number;
    failed?: number;
    inventorySynced?: number;
    activeItems?: number;
    inactiveItems?: number;
    services?: number;
    products?: number;
    rentals?: number;
    estimatedBaseValue?: number;
    previewItems?: Array<{
      lineNumber: number;
      status: 'CREATED' | 'UPDATED' | 'SKIPPED' | 'FAILED';
      name: string;
      type?: string;
      categoryName?: string;
      inventorySynced?: boolean;
      reason?: string;
    }>;
  };
  fileName?: string | null;
  fileMimeType?: string | null;
  fileUrl?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  failedAt?: string | null;
}

export interface WhatsAppConfig {
  phoneNumberId?: string;
  wabaId?: string;
  accessToken?: string;
  webhookVerifyToken?: string;
  isConnected?: boolean;
}

export interface WhatsAppConnection {
  provider: 'TWILIO';
  mode: 'EMBEDDED_SIGNUP';
  embeddedSignupReady: boolean;
  embeddedSignup: {
    appId?: string | null;
    configurationId?: string | null;
    solutionId?: string | null;
  };
  connection: {
    provider: 'BUBBLEWHATS' | 'TWILIO' | 'D360';
    status: string;
    whatsappNumber?: string | null;
    senderId?: string | null;
    senderSid?: string | null;
    wabaId?: string | null;
  } | null;
}

export interface InstagramConfig {
  pageId?: string;
  accessToken?: string;
  isConnected?: boolean;
}

export interface AIConfig {
  basePrompt?: string;
  tone?: 'formal' | 'casual' | 'friendly' | 'professional';
  language?: string;
  businessRules?: string[];
  handoffConfidence?: number;
  escalationMessage?: string;
  guidedDiscovery?: boolean;
  maxFirstResponseItems?: number;
  maxTokensPerResponse?: number;
  updatedAt?: string;
}

export interface Promotion {
  id: string;
  title: string;
  description?: string;
  discount?: number;
  discountType?: 'PERCENTAGE' | 'FIXED';
  validFrom?: string;
  validTo?: string;
  active?: boolean;
  imageUrl?: string;
  assignedUserId?: string;
  assignedUserName?: string;
  value?: string;
  expiresAt?: string;
}

export type ContactStage =
  | 'LEAD'
  | 'PROSPECT'
  | 'OPPORTUNITY'
  | 'CUSTOMER'
  | 'INACTIVE';

export interface Contact {
  id: string;
  branchId?: string | null;
  name: string;
  phone: string;
  document?: string;
  email?: string;
  stage: ContactStage;
  tags?: string[];
  notes?: string;
  source?: string;
  createdAt: string;
  updatedAt: string;
  lastInteraction?: string;
  lastMessageAt?: string;
}

export interface ContactDetail extends Contact {
  lastInteraction?: string;
}

export interface TimelineEvent {
  id: string;
  type: 'MESSAGE' | 'STAGE_CHANGE' | 'NOTE' | 'APPOINTMENT' | 'PAYMENT' | 'AI_ACTION';
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ContactTimelineEntry {
  timestamp: string;
  type:
    | 'CONTACT_CREATED'
    | 'CONTACT_STAGE'
    | 'CONTACT_NOTE'
    | 'RECOVERY_CASE_CREATED'
    | 'RECOVERY_STATUS'
    | 'CONVERSATION_STARTED'
    | 'MESSAGE_INBOUND'
    | 'MESSAGE_OUTBOUND'
    | 'PAYMENT_CONFIRMED'
    | 'PAYMENT_OVERDUE'
    | 'PAYMENT_REFUNDED'
    | 'SCHEDULING_RESERVED'
    | 'FOLLOW_UP_SCHEDULED'
    | 'FOLLOW_UP_CANCELLED'
    | 'FOLLOW_UP_TRIGGERED'
    | 'FOLLOW_UP_SKIPPED'
    | 'HANDOFF_HUMAN';
  title: string;
  details: Record<string, unknown>;
}

export interface ContactTimelineResult {
  contact: {
    id: string;
    name: string;
    phone: string;
    stage: ContactStage;
  };
  entries: ContactTimelineEntry[];
}

export interface ContactImportResultItem {
  lineNumber: number;
  status: 'CREATED' | 'UPDATED' | 'SKIPPED' | 'FAILED';
  name: string;
  phone: string;
  reason?: string;
}

export interface ContactImportResult {
  totalRows: number;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  items: ContactImportResultItem[];
}

export type ContactAsyncJobType = 'IMPORT_CONTACTS' | 'EXPORT_CONTACTS_CSV';
export type ContactAsyncJobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface ContactAsyncJob {
  id: string;
  tenantId: string;
  branchId?: string | null;
  type: ContactAsyncJobType;
  status: ContactAsyncJobStatus;
  requestedByUserId?: string | null;
  requestedByUserEmail?: string | null;
  progress: number;
  totalItems: number;
  processedItems: number;
  resultSummary?: Record<string, unknown> & {
    previewItems?: ContactImportResultItem[];
    totalRows?: number;
    processed?: number;
    created?: number;
    updated?: number;
    skipped?: number;
    failed?: number;
    totalContacts?: number;
    contactsWithTimelineMatch?: number;
    totalTimelineEvents?: number;
  };
  fileName?: string | null;
  fileMimeType?: string | null;
  fileUrl?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  failedAt?: string | null;
}

export interface ContactsReportSummaryEntry {
  total: number;
}

export interface ContactsReport {
  generatedAt: string;
  summary: {
    totalContacts: number;
    contactsWithTimelineMatch: number;
    contactsWithoutInteraction: number;
    pipelineContacts: number;
    customers: number;
    inactive: number;
    totalTimelineEvents: number;
    topTags: Array<{ tag: string; total: number }>;
    topChannels: Array<{ channel: string; total: number }>;
    topTimelineTypes: Array<{ type: string; total: number }>;
  };
  contacts: Array<{
    id: string;
    name: string;
    phone: string;
    document?: string;
    email?: string;
    stage: ContactStage;
    tags: string[];
    createdAt: string;
    updatedAt: string;
    lastInteraction?: string;
    lastTimelineEventAt?: string;
    timelineEventCount: number;
    inboundMessages: number;
    outboundMessages: number;
    channels: string[];
    timelineTypes: string[];
  }>;
}

export type ConversationStatus =
  | 'ACTIVE'
  | 'PENDING_HUMAN'
  | 'ARCHIVED';

export interface Conversation {
  id: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  status: ConversationStatus;
  lastMessage?: string;
  lastMessageDirection?: 'INBOUND' | 'OUTBOUND';
  lastMessageAt?: string;
  lastMessageSequence?: number;
  lastInboundAt?: string;
  lastOutboundAt?: string;
  updatedAt?: string;
  unreadCount?: number;
  channel?: 'WHATSAPP' | 'INSTAGRAM';
  assignedTo?: string;
  assignedToUserId?: string;
  assignedToName?: string;
  assignedAt?: string;
  origin?: 'ORGANIC' | 'PROSPECTING' | 'ADS' | 'RECOVERY';
  intelligence?: {
    summary: string;
    sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
    tags: string[];
    interests: string[];
    nextStep?: string | null;
    lossReason?: string | null;
    updatedAt: string;
  };
  createdAt: string;
}

export type MessageDirection = 'INBOUND' | 'OUTBOUND';
export type MessageStatus =
  | 'PENDING'
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED';
export type MessageSender = 'CONTACT' | 'AGENT' | 'AI';

export interface Message {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  sender: MessageSender;
  content: string;
  status?: MessageStatus;
  timestamp: string;
  mediaUrl?: string;
  mediaType?: string;
}

export interface MessagingRealtimeEvent {
  type:
    | 'connection.ready'
    | 'message.received'
    | 'message.queued'
    | 'message.sent'
    | 'message.failed'
    | 'conversation.status.changed';
  tenantId: string;
  conversationId?: string;
  messageId?: string;
  channel?: string;
  status?: string;
  at: string;
}

export interface Professional {
  id: string;
  tenantId?: string;
  branchId?: string | null;
  name: string;
  role?: string | null;
  active?: boolean;
  createdAt?: string;
  email?: string;
  phone?: string;
  specialties?: string[];
  avatarUrl?: string;
}

export interface ScheduleCategory {
  id: string;
  tenantId?: string;
  branchId?: string | null;
  name: string;
  unit?: 'PER_MINUTE' | 'PER_SESSION' | 'PER_CONSULTATION';
  duration?: number;
  durationMinutes?: number | null;
  basePrice?: number | null;
  active?: boolean;
  createdAt?: string;
  price?: number;
  description?: string;
}

export interface AvailabilitySlot {
  id: string;
  professionalId: string;
  date: string;
  startTime?: string;
  endTime?: string;
  startsAt?: string;
  endsAt?: string;
  label?: string | null;
  isOnline?: boolean;
  status?:
    | 'AVAILABLE'
    | 'PRE_RESERVED'
    | 'RESERVED'
    | 'COMPLETED'
    | 'NO_SHOW'
    | 'BLOCKED';
  reserved?: boolean;
  reservedBy?: string;
  reservedAt?: string;
  payment?: {
    reference: string;
    linkId: string;
    linkUrl: string;
    amount: number;
    billingType: 'UNDEFINED' | 'BOLETO' | 'CREDIT_CARD' | 'PIX';
    status: 'PENDING' | 'PAID';
    expiresAt?: string;
    confirmedAt?: string;
  };
  reservedFor?: {
    contactId?: string;
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
    categoryId?: string;
    categoryName?: string;
    conversationId?: string;
    notes?: string;
    isOnline?: boolean;
    meetingProvider?: 'GOOGLE_MEET';
    meetingUrl?: string;
  };
  customPrice?: number | null;
}

export interface CategoryAvailability {
  professionalId: string;
  professionalName: string;
  slots: AvailabilitySlot[];
}

export type SchedulingAsyncJobType = 'EXPORT_SCHEDULING_REPORT_CSV';
export type SchedulingAsyncJobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface SchedulingAsyncJob {
  id: string;
  tenantId: string;
  branchId?: string | null;
  type: SchedulingAsyncJobType;
  status: SchedulingAsyncJobStatus;
  requestedByUserId?: string | null;
  requestedByUserEmail?: string | null;
  progress: number;
  totalItems: number;
  processedItems: number;
  resultSummary?: Record<string, unknown> & {
    totalSlots?: number;
    reservedSlots?: number;
    blockedSlots?: number;
    availableSlots?: number;
    completedSlots?: number;
    noShowSlots?: number;
    estimatedRevenue?: number;
  };
  fileName?: string | null;
  fileMimeType?: string | null;
  fileUrl?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  failedAt?: string | null;
}

export interface InventoryItemRecord {
  id: string;
  catalogItemId?: string;
  name: string;
  sku: string;
  availableQuantity: number;
  availabilityStatus: 'AVAILABLE' | 'LOW_STOCK' | 'UNAVAILABLE' | 'RESERVED';
  currentPrice?: number;
  currency?: string;
  source: 'MANUAL_SNAPSHOT' | 'CSV_IMPORT' | 'ERP_SYNC' | 'PDV_SYNC' | 'ECOMMERCE_SYNC';
  externalReference?: string;
  categoryName?: string;
  lastSyncedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type InventoryAsyncJobType = 'EXPORT_INVENTORY_REPORT_CSV';
export type InventoryAsyncJobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface InventoryAsyncJob {
  id: string;
  tenantId: string;
  type: InventoryAsyncJobType;
  status: InventoryAsyncJobStatus;
  requestedByUserId?: string | null;
  requestedByUserEmail?: string | null;
  progress: number;
  totalItems: number;
  processedItems: number;
  resultSummary?: Record<string, unknown> & {
    totalItems?: number;
    totalQuantity?: number;
    availableItems?: number;
    lowStockItems?: number;
    unavailableItems?: number;
    reservedItems?: number;
    estimatedInventoryValue?: number;
  };
  fileName?: string | null;
  fileMimeType?: string | null;
  fileUrl?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  failedAt?: string | null;
}

export type InventoryConnectionSourceType =
  | 'MANUAL_SNAPSHOT'
  | 'CSV_IMPORT'
  | 'ERP_SYNC'
  | 'PDV_SYNC'
  | 'ECOMMERCE_SYNC'
  | 'BLING'
  | 'TINY'
  | 'SHOPIFY'
  | 'NUVEMSHOP'
  | 'WOOCOMMERCE'
  | 'MERCADOLIVRE'
  | 'SHOPEE';

export interface InventoryConnection {
  id: string;
  sourceType: InventoryConnectionSourceType | string;
  providerName: string;
  status: 'ACTIVE' | 'PENDING' | 'FAILED';
  configSummary?: string;
  lastSyncedAt?: string;
}

export interface SalesMetrics {
  totalConversations: number;
  totalLeads: number;
  totalConversions: number;
  conversionRate: number;
  totalRevenue: number;
  averageTicket: number;
  messagesSent: number;
  messagesReceived: number;
  period: { start: string; end: string };
  dailyData?: Array<{
    date: string;
    conversations: number;
    conversions: number;
    revenue: number;
  }>;
}

export interface PaymentLink {
  id: string;
  amount: number;
  description: string;
  url?: string;
  status: 'ACTIVE' | 'PAID' | 'EXPIRED';
  createdAt: string;
  contactId?: string;
  contactName?: string;
}

export interface UsageData {
  tenantId: string;
  plan: string;
  scheduledPlan?: string;
  messages: {
    used: number;
    quota: number;
  };
  aiTokens: {
    used: number;
    quota: number;
  };
  contacts: {
    used: number;
    quota: number;
  };
  billingCycle: { start: string; end: string };
}

export interface BillingPlan {
  code: 'ESSENCIAL' | 'PROFISSIONAL' | 'ESCALA' | 'TRIAL';
  displayName: string;
  description?: string | null;
  monthlyPrice: number;
  messagesQuota: number;
  aiTokensQuota: number;
  contactsQuota: number;
  sortOrder: number;
  active: boolean;
  features: string[];
  config?: {
    limits?: {
      branches?: number;
      whatsappNumbers?: number;
      users?: number;
      prospectingDaily?: number;
    };
    modules?: Record<string, boolean>;
    [key: string]: unknown;
  };
}

export interface BillingAddonCatalogItem {
  code: string;
  displayName: string;
  description?: string | null;
  category?: string | null;
  monthlyPrice: number;
  pricingVersion?: string | null;
  salesPitch?: string | null;
  includedInPlans: string[];
  subscribed: boolean;
  includedInPlan: boolean;
  enabled: boolean;
  recommended: boolean;
  primaryRecommendation: boolean;
  marketingHeadline?: string | null;
  recommendationSalesPitch?: string | null;
  selectable: boolean;
}

export interface BillingSubscriptionCatalog {
  tenantId: string;
  businessType?: string | null;
  niche: {
    code: string;
    displayName: string;
    description?: string | null;
    pains: string[];
  } | null;
  subscription: TenantBillingAccess;
  availableAddons: BillingAddonCatalogItem[];
}

export type ProspectSearchStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
export type ProspectSearchSource = 'GOOGLE_PLACES' | 'GOOGLE_ADS_AUDIENCE';

export interface ProspectSearch {
  id: string;
  tenantId?: string;
  businessTypeQuery: string;
  city: string;
  state?: string;
  neighborhood?: string;
  source: ProspectSearchSource;
  maxResults: number;
  status: ProspectSearchStatus;
  discoveredCount: number;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProspectResult {
  id: string;
  searchId: string;
  source: ProspectSearchSource;
  externalId?: string;
  businessName: string;
  city: string;
  state?: string;
  phone?: string;
  whatsappPhone?: string;
  instagramUrl?: string;
  email?: string;
  website?: string;
  createdAt: string;
}

export interface AdsInsightQuery {
  id: string;
  tenantId: string;
  source: 'GOOGLE_ADS_AUDIENCE';
  segment: string;
  city?: string;
  state?: string;
  country: string;
  ageRange?: string;
  gender?: string;
  interest?: string;
  status: ProspectSearchStatus;
  discoveredCount: number;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdsInsightResult {
  id: string;
  queryId: string;
  resultType: 'DEMAND_ESTIMATE' | 'INTEREST' | 'REGION' | 'KEYWORD_THEME';
  title: string;
  subtitle?: string;
  metricValue?: number;
  score?: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export type ProspectLeadImportStatus =
  | 'NEW'
  | 'IMPORTED'
  | 'REUSED'
  | 'SKIPPED_NO_PHONE';

export interface AdsLeadCapture {
  id: string;
  source: 'GOOGLE_ADS_LEAD_FORM';
  externalLeadId: string;
  googleAdsCustomerId?: string;
  campaignName?: string;
  formName?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
  instagramHandle?: string;
  document?: string;
  interests?: Record<string, unknown>;
  rawPayload?: Record<string, unknown>;
  submissionAt: string;
  importStatus: ProspectLeadImportStatus;
  contactId?: string;
}

export interface AdsLeadCapturesPage {
  items: AdsLeadCapture[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type GoogleAdsTenantConnectionStatus =
  | 'NOT_CONNECTED'
  | 'PENDING_ACCOUNT_SELECTION'
  | 'CONNECTED';

export interface GoogleAdsConnectionStatus {
  connected: boolean;
  status: GoogleAdsTenantConnectionStatus;
  googleEmail?: string;
  customerId?: string;
  customerName?: string;
  loginCustomerId?: string;
  accountSelected: boolean;
  connectedAt?: string;
  updatedAt?: string;
}

export interface GoogleAdsAccessibleAccount {
  customerId: string;
  descriptiveName: string;
  isManager: boolean;
}

export type ProspectCampaignStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'ARCHIVED';
export type ProspectExecutionStatus =
  | 'PENDING'
  | 'CONTACTED'
  | 'RESPONDED'
  | 'STOPPED'
  | 'FAILED';

export type ProspectCampaignAudienceType = 'REENGAGEMENT' | 'CONTACT_LIST';
export type ProspectCampaignChannel = 'WHATSAPP' | 'INSTAGRAM';

export interface Campaign {
  id: string;
  tenantId?: string;
  name: string;
  objective: string;
  audienceType: ProspectCampaignAudienceType;
  channel: ProspectCampaignChannel;
  targetContactIds: string[];
  messageTemplate?: string;
  dailyLimit: number;
  status: ProspectCampaignStatus;
  createdAt: string;
}

export interface ProspectImportContactsResult {
  searchId: string;
  importedCount: number;
  skippedMissingPhone: number;
  skippedDuplicates: number;
  importedContacts: Array<{
    id: string;
    name: string;
    phone: string;
    email?: string;
  }>;
}

export interface ProspectSelectedResultsOutput {
  searchId: string;
  campaignId: string;
  importedCount: number;
  reusedExistingContacts: number;
  skippedMissingPhone: number;
  dispatchedExecutions: number;
  targetContactIds: string[];
}

export interface ProspectCampaignStartResult {
  campaignId: string;
  createdExecutions: number;
  skippedExecutions: number;
  executions: Array<{
    id: string;
    contactId: string;
    status: ProspectExecutionStatus;
  }>;
}

export interface ProspectCampaignDispatchNextResult {
  campaignId: string;
  executionId: string;
  conversationId: string;
  messageId: string;
  status: ProspectExecutionStatus;
  renderedMessage: string;
  remainingPendingExecutions: number;
}

export type ProspectingAsyncJobType =
  | 'EXPORT_PROSPECT_SEARCHES_CSV'
  | 'EXPORT_PROSPECT_CAMPAIGNS_CSV';
export type ProspectingAsyncJobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface ProspectingAsyncJob {
  id: string;
  tenantId: string;
  type: ProspectingAsyncJobType;
  status: ProspectingAsyncJobStatus;
  requestedByUserId?: string | null;
  requestedByUserEmail?: string | null;
  progress: number;
  totalItems: number;
  processedItems: number;
  resultSummary?: Record<string, unknown> & {
    totalSearches?: number;
    runningSearches?: number;
    completedSearches?: number;
    failedSearches?: number;
    totalDiscovered?: number;
    actualResultsCount?: number;
    whatsappReadyCount?: number;
    instagramReadyCount?: number;
    emailCount?: number;
    totalCampaigns?: number;
    activeCampaigns?: number;
    draftCampaigns?: number;
    pausedCampaigns?: number;
    totalAudience?: number;
    totalExecutions?: number;
    contactedExecutions?: number;
    respondedExecutions?: number;
    failedExecutions?: number;
  };
  fileName?: string | null;
  fileMimeType?: string | null;
  fileUrl?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  failedAt?: string | null;
}

export type RecoverySource = 'CRM' | 'MANUAL' | 'IMPORT';
export type RecoveryStatus =
  | 'READY_TO_CONTACT'
  | 'CONTACTED'
  | 'NEGOTIATING'
  | 'PROMISE_TO_PAY'
  | 'PAID'
  | 'NO_RESPONSE'
  | 'INVALID_CONTACT'
  | 'STOPPED';

export interface RecoveryCase {
  id: string;
  branchId?: string | null;
  contactId?: string | null;
  playbookId?: string | null;
  playbookPhaseIndex?: number;
  lastPlaybookPhaseExecutedAt?: string | null;
  debtorName: string;
  debtorCompanyName?: string;
  debtorDocument?: string;
  phone: string;
  source: RecoverySource;
  status: RecoveryStatus;
  amountDue?: number;
  dueDate?: string;
  externalReference?: string;
  paymentReference?: string;
  chargeType?: string;
  chargeTitle?: string;
  chargeDescription?: string;
  referencePeriod?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  relatedEntityLabel?: string;
  assignedTags?: string[];
  lastContactedAt?: string;
  nextActionAt?: string;
  paidAt?: string;
  suggestedReply?: string;
  suggestedNextAction?: string;
  guidanceGeneratedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type RecoveryAsyncJobType = 'EXPORT_RECOVERY_REPORT_CSV';
export type RecoveryAsyncJobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface RecoveryAsyncJob {
  id: string;
  tenantId: string;
  branchId?: string | null;
  type: RecoveryAsyncJobType;
  status: RecoveryAsyncJobStatus;
  requestedByUserId?: string | null;
  requestedByUserEmail?: string | null;
  progress: number;
  totalItems: number;
  processedItems: number;
  resultSummary?: Record<string, unknown> & {
    totalCases?: number;
    openCases?: number;
    promiseCases?: number;
    paidCases?: number;
    guidanceCases?: number;
    openAmount?: number;
    paidAmount?: number;
  };
  fileName?: string | null;
  fileMimeType?: string | null;
  fileUrl?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  failedAt?: string | null;
}

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PageMeta;
}

export type SalesPaymentLinkStatus =
  | 'ACTIVE'
  | 'PAUSED'
  | 'DELETED'
  | 'PAID'
  | 'OVERDUE'
  | 'REFUNDED'
  | 'EXPIRED';

export type SalesPaymentLinkSource = 'MANUAL' | 'AI';
export type SalesPaymentResourceType = 'PAYMENT_LINK' | 'PAYMENT';
export type SalesPaymentRecurrenceFrequency = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export interface SalesPaymentLink {
  id: string;
  branchId?: string | null;
  externalId?: string;
  name: string;
  description?: string;
  label?: string;
  value: number;
  url: string;
  billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO' | 'UNDEFINED';
  status: SalesPaymentLinkStatus;
  source: SalesPaymentLinkSource;
  resourceType: SalesPaymentResourceType;
  contactId?: string;
  contactName?: string;
  conversationId?: string;
  expiresAt?: string;
  recurrenceEnabled?: boolean;
  recurrenceFrequency?: SalesPaymentRecurrenceFrequency;
  recurrenceStartDate?: string;
  recurrenceEndDate?: string;
  recurrenceTotalValue?: number;
  recurrenceNextRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SalesPaymentLinksSummary {
  totalLinks: number;
  activeLinks: number;
  pausedLinks: number;
  paidLinks: number;
  expiredLinks: number;
  estimatedRevenue: number;
  paidRevenue: number;
}

export interface SalesPaymentLinksPage {
  items: SalesPaymentLink[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary: SalesPaymentLinksSummary;
}

export interface TenantFinancialAccountStatus {
  configured: boolean;
  provider: 'ASAAS';
  status: string;
  walletId?: string | null;
  accountId?: string | null;
}

export type AlertReminderFrequency = 'ONCE' | 'DAILY';
export type AlertReminderStatus = 'ACTIVE' | 'PAUSED' | 'SENT';

export interface AlertReminder {
  id: string;
  tenantId: string;
  branchId?: string | null;
  userId: string;
  userName: string;
  userPhone: string;
  userEmail?: string;
  title: string;
  message: string;
  frequency: AlertReminderFrequency;
  scheduledAt?: string;
  timeOfDay?: string;
  nextTriggerAt?: string;
  lastTriggeredAt?: string;
  status: AlertReminderStatus;
  createdAt: string;
  updatedAt: string;
}

export type SupportFeedbackType = 'BUG' | 'SUGGESTION' | 'IMPROVEMENT';
export type SupportFeedbackStatus = 'OPEN' | 'REVIEWED' | 'CLOSED';

export interface SupportFeedback {
  id: string;
  tenantId: string;
  branchId?: string | null;
  userId: string;
  userName: string;
  userEmail: string;
  type: SupportFeedbackType;
  title: string;
  description: string;
  pagePath?: string;
  appModule?: string | null;
  status: SupportFeedbackStatus;
  createdAt: string;
  updatedAt: string;
}
