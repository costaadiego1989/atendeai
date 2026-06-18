import { SalesMetric } from '../entities/SalesMetric';

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
export type SalesPaymentRecurrenceFrequency =
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'YEARLY';
export type SalesDiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';
export type SalesPromotionTargetType = 'ITEM' | 'CATEGORY';

export interface SalesPromotionTargetRecord {
  targetType: SalesPromotionTargetType;
  targetId: string;
}

export interface SalesPaymentLinkRecord {
  id: string;
  tenantId: string;
  branchId?: string | null;
  providerLinkId: string;
  externalId: string;
  name: string;
  description?: string | null;
  label?: string | null;
  value: number;
  url: string;
  billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO' | 'UNDEFINED';
  status: SalesPaymentLinkStatus;
  source: SalesPaymentLinkSource;
  resourceType?: SalesPaymentResourceType;
  contactId?: string | null;
  contactName?: string | null;
  conversationId?: string | null;
  catalogItemId?: string | null;
  catalogItemSku?: string | null;
  catalogItemName?: string | null;
  expiresAt?: Date | null;
  recurrenceEnabled?: boolean;
  recurrenceFrequency?: SalesPaymentRecurrenceFrequency | null;
  recurrenceStartDate?: Date | null;
  recurrenceEndDate?: Date | null;
  recurrenceTotalValue?: number | null;
  recurrenceNextRunAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface ListSalesPaymentLinksFilters {
  search?: string;
  status?: SalesPaymentLinkStatus | 'ALL';
  source?: SalesPaymentLinkSource | 'ALL';
  branchId?: string | null;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  page: number;
  pageSize: number;
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

export interface ISalesMetricsRepository {
  findByTenantAndDate(
    tenantId: string,
    date: Date,
  ): Promise<SalesMetric | null>;
  save(metric: SalesMetric): Promise<void>;
  incrementMetric(
    tenantId: string,
    date: Date,
    type: 'MESSAGE' | 'INTENT' | 'LINK',
    value?: number,
  ): Promise<void>;
  getMetrics(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<SalesMetric[]>;
}

export interface ISalesPaymentLinksRepository {
  createPaymentLink(
    record: Omit<SalesPaymentLinkRecord, 'createdAt' | 'updatedAt'>,
  ): Promise<SalesPaymentLinkRecord>;
  listPaymentLinks(
    tenantId: string,
    filters: ListSalesPaymentLinksFilters,
  ): Promise<{
    items: SalesPaymentLinkRecord[];
    total: number;
    summary: SalesPaymentLinksSummary;
  }>;
  findPaymentLinkById(
    tenantId: string,
    paymentLinkId: string,
  ): Promise<SalesPaymentLinkRecord | null>;
  updatePaymentLinkStatus(
    tenantId: string,
    paymentLinkId: string,
    status: SalesPaymentLinkStatus,
    deletedAt?: Date | null,
  ): Promise<SalesPaymentLinkRecord | null>;
  updatePaymentLinkStatusByExternalReference(
    tenantId: string,
    externalReference: string,
    status: Extract<SalesPaymentLinkStatus, 'PAID' | 'OVERDUE' | 'REFUNDED'>,
  ): Promise<SalesPaymentLinkRecord | null>;

  findContactNameById(
    tenantId: string,
    contactId: string,
  ): Promise<string | null>;
}

export interface SalesPromotionRecord {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  discountType: SalesDiscountType;
  discountValue: number;
  minimumOrder?: number | null;
  imageUrl?: string | null;
  startsAt: Date;
  expiresAt?: Date | null;
  active: boolean;
  catalogItemId?: string | null;
  targets?: SalesPromotionTargetRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ISalesPromotionRepository {
  createPromotion(
    record: Omit<SalesPromotionRecord, 'createdAt' | 'updatedAt'>,
  ): Promise<SalesPromotionRecord>;
  updatePromotion(
    tenantId: string,
    id: string,
    data: Partial<Omit<SalesPromotionRecord, 'id' | 'tenantId' | 'createdAt'>>,
  ): Promise<SalesPromotionRecord | null>;
  deletePromotion(tenantId: string, id: string): Promise<void>;
  findPromotionById(
    tenantId: string,
    id: string,
  ): Promise<SalesPromotionRecord | null>;
  listPromotions(
    tenantId: string,
    onlyActive?: boolean,
  ): Promise<SalesPromotionRecord[]>;
}

export interface SalesCouponRecord {
  id: string;
  tenantId: string;
  promotionId?: string | null;
  code: string;
  description?: string | null;
  discountType: SalesDiscountType;
  discountValue: number;
  maxUses: number;
  usedCount: number;
  startsAt: Date;
  expiresAt?: Date | null;
  active: boolean;
  minimumOrder?: number | null;
  catalogItemId?: string | null;
  targets?: SalesPromotionTargetRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ISalesCouponRepository {
  createCoupon(
    record: Omit<SalesCouponRecord, 'createdAt' | 'updatedAt' | 'usedCount'>,
  ): Promise<SalesCouponRecord>;
  updateCoupon(
    tenantId: string,
    id: string,
    data: Partial<
      Omit<SalesCouponRecord, 'id' | 'tenantId' | 'createdAt' | 'usedCount'>
    >,
  ): Promise<SalesCouponRecord | null>;
  deleteCoupon(tenantId: string, id: string): Promise<void>;
  findCouponById(
    tenantId: string,
    id: string,
  ): Promise<SalesCouponRecord | null>;
  findCouponByCode(
    tenantId: string,
    code: string,
  ): Promise<SalesCouponRecord | null>;
  listCoupons(
    tenantId: string,
    onlyActive?: boolean,
  ): Promise<SalesCouponRecord[]>;
  incrementCouponUsage(
    tenantId: string,
    id: string,
  ): Promise<SalesCouponRecord | null>;
  /**
   * COM1: Atomically increments used_count only when used_count < max_uses AND
   * active = true. Returns updated record, or null if the coupon is exhausted /
   * inactive / not found. Callers must treat null as CouponMaxUsesReachedException.
   */
  atomicIncrementCouponUsage(
    tenantId: string,
    id: string,
  ): Promise<SalesCouponRecord | null>;
}

export interface ISalesRepository
  extends
    ISalesMetricsRepository,
    ISalesPaymentLinksRepository,
    ISalesPromotionRepository,
    ISalesCouponRepository {}

export const SALES_REPOSITORY = Symbol('SALES_REPOSITORY');
export const SALES_METRICS_REPOSITORY = Symbol('SALES_METRICS_REPOSITORY');
export const SALES_PAYMENT_LINKS_REPOSITORY = Symbol(
  'SALES_PAYMENT_LINKS_REPOSITORY',
);
export const SALES_PROMOTION_REPOSITORY = Symbol('SALES_PROMOTION_REPOSITORY');
export const SALES_COUPON_REPOSITORY = Symbol('SALES_COUPON_REPOSITORY');
