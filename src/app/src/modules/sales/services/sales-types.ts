export interface SalesMetricPoint {
  date: string;
  totalMessages: number;
  purchaseIntents: number;
  paymentLinksGenerated: number;
  estimatedRevenue: number;
}

export interface SalesMetricsSnapshot {
  metrics: SalesMetricPoint[];
  summary: {
    totalMessages: number;
    totalIntents: number;
    totalLinks: number;
    totalRevenue: number;
  };
}

export interface ListPaymentLinksParams {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  source?: string;
  branchId?: string | null;
  dateFrom?: string;
  dateTo?: string;
}

export interface CreateSalesPaymentLinkInput {
  name: string;
  description?: string;
  label?: string;
  value: number;
  billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO' | 'UNDEFINED';
  expiresAt?: string;
  source?: 'MANUAL' | 'AI';
  branchId?: string | null;
}

export interface CreateSalesSplitChargeInput {
  contactId: string;
  conversationId?: string | null;
  customerDocument?: string;
  name: string;
  description?: string;
  label?: string;
  value: number;
  billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO';
  dueDate?: string;
  sendViaWhatsApp?: boolean;
  recurring?: boolean;
  recurrenceFrequency?: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  recurrenceStartDate?: string;
  recurrenceEndDate?: string;
  branchId?: string | null;
}

export interface CreateSalesSplitChargeResponse {
  id: string;
  paymentId: string;
  url: string;
  dueDate: string;
  contactId: string;
  conversationId?: string | null;
  tenantSplitPercent: number;
  platformFeePercent: number;
  status: 'ACTIVE' | 'PAID' | 'OVERDUE' | 'REFUNDED' | 'EXPIRED' | 'PAUSED' | 'DELETED';
  recurrence?: {
    frequency?: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    startDate?: string;
    endDate?: string;
    totalValue?: number;
    nextRunAt?: string;
  };
}

export interface BootstrapTenantFinancialAccountInput {
  companyType: string;
  addressNumber: string;
  complement?: string;
  birthDate?: string;
}

export interface AISalesPaymentLinkSuggestion {
  name: string;
  description?: string;
  label?: string;
  value: number;
  billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO' | 'UNDEFINED';
  expiresAt?: string;
  source: 'AI';
}

export interface SalesPromotion {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  minimumOrder?: number | null;
  imageUrl?: string | null;
  startsAt: string;
  expiresAt?: string | null;
  active: boolean;
  catalogItemId?: string | null;
  targets?: SalesPromotionTarget[];
  createdAt: string;
  updatedAt: string;
}

export interface SalesPromotionTarget {
  targetType: 'ITEM' | 'CATEGORY';
  targetId: string;
}

export interface CreatePromotionInput {
  title: string;
  description: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  minimumOrder?: number | null;
  imageUrl?: string | null;
  startsAt: string;
  expiresAt?: string | null;
  catalogItemId?: string | null;
  targets?: SalesPromotionTarget[];
}

export interface UpdatePromotionInput extends Partial<Omit<CreatePromotionInput, 'id'>> {
  id: string;
  active?: boolean;
}

export interface SalesCoupon {
  id: string;
  tenantId: string;
  promotionId?: string | null;
  code: string;
  description?: string | null;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  maxUses: number;
  usedCount: number;
  startsAt: string;
  expiresAt?: string | null;
  active: boolean;
  catalogItemId?: string | null;
  targets?: SalesPromotionTarget[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCouponInput {
  code: string;
  description?: string | null;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  maxUses: number;
  startsAt: string;
  expiresAt?: string | null;
  catalogItemId?: string | null;
  targets?: SalesPromotionTarget[];
  promotionId?: string | null;
}

export interface UpdateCouponInput extends Partial<Omit<CreateCouponInput, 'id'>> {
  id: string;
  active?: boolean;
}

export interface RedeemSalesCouponInput {
  code: string;
  contactId?: string;
  conversationId?: string | null;
}

export type SalesCouponRedeemResponse = Record<string, unknown> & {
  coupon?: SalesCoupon;
};
