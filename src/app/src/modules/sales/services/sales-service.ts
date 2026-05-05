import { salesAIService } from './sales-ai-service';
import { salesFinancialAccountService } from './sales-financial-account-service';
import { salesMetricsService } from './sales-metrics-service';
import { salesPaymentLinksService } from './sales-payment-links-service';
import { salesPromotionsService } from './sales-promotions-service';
import { salesCouponsService } from './sales-coupons-service';

export type {
  AISalesPaymentLinkSuggestion,
  BootstrapTenantFinancialAccountInput,
  CreateSalesPaymentLinkInput,
  CreateSalesSplitChargeInput,
  CreateSalesSplitChargeResponse,
  ListPaymentLinksParams,
  SalesMetricPoint,
  SalesMetricsSnapshot,
  SalesPromotion,
  CreatePromotionInput,
  UpdatePromotionInput,
  SalesCoupon,
  CreateCouponInput,
  UpdateCouponInput,
  RedeemSalesCouponInput,
  SalesCouponRedeemResponse,
} from './sales-types';

export const salesService = {
  ...salesMetricsService,
  ...salesPaymentLinksService,
  ...salesFinancialAccountService,
  ...salesAIService,
  ...salesPromotionsService,
  ...salesCouponsService,
};
