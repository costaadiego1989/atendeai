import { Module } from '@nestjs/common';
import { CreatePaymentLinkUseCase } from './application/use-cases/CreatePaymentLinkUseCase';
import { ICreatePaymentLinkUseCase } from './application/use-cases/interfaces/ICreatePaymentLinkUseCase';
import { TrackSalesMetricUseCase } from './application/use-cases/TrackSalesMetricUseCase';
import { SalesAnalyticsHandler } from './application/handlers/SalesAnalyticsHandler';
import { PrismaSalesRepository } from './infrastructure/persistence/repositories/PrismaSalesRepository';
import {
  SALES_METRICS_REPOSITORY,
  SALES_PAYMENT_LINKS_REPOSITORY,
  SALES_REPOSITORY,
  SALES_PROMOTION_REPOSITORY,
  SALES_COUPON_REPOSITORY,
} from './domain/repositories/ISalesRepository';
import { PaymentModule } from '../payment/payment.module';
import { TenantModule } from '../tenant/tenant.module';
import { DatabaseModule } from '../../shared/infrastructure/database/DatabaseModule';
import { AuthModule } from '../auth/auth.module';
import { SalesController } from './presentation/controllers/SalesController';
import { GetSalesMetricsUseCase } from './application/use-cases/GetSalesMetricsUseCase';
import { ListPaymentLinksUseCase } from './application/use-cases/ListPaymentLinksUseCase';
import { PausePaymentLinkUseCase } from './application/use-cases/PausePaymentLinkUseCase';
import { ResumePaymentLinkUseCase } from './application/use-cases/ResumePaymentLinkUseCase';
import { DeletePaymentLinkUseCase } from './application/use-cases/DeletePaymentLinkUseCase';
import { SuggestPaymentLinkWithAIUseCase } from './application/use-cases/SuggestPaymentLinkWithAIUseCase';
import { AI_ENGINE } from '../ai/application/ports/IAIEngine';
import { DeepSeekAdapter } from '../ai/infrastructure/adapters/DeepSeekAdapter';
import { AgentRulesModule } from '../agent-rules/agent-rules.module';
import { CreateSplitPaymentChargeUseCase } from './application/use-cases/CreateSplitPaymentChargeUseCase';
import { ContactModule } from '../contact/contact.module';
import { SalesPaymentLinksSchemaService } from './infrastructure/persistence/services/SalesPaymentLinksSchemaService';
import { SalesPaymentLinkLifecycleService } from './application/services/SalesPaymentLinkLifecycleService';
import { SalesPaymentLinksReportCsvBuilder } from './application/services/SalesPaymentLinksReportCsvBuilder';
import { GenerateSalesPaymentLinksReportUseCase } from './application/use-cases/GenerateSalesPaymentLinksReportUseCase';
import { CreatePromotionUseCase } from './application/use-cases/CreatePromotionUseCase';
import { UpdatePromotionUseCase } from './application/use-cases/UpdatePromotionUseCase';
import { DeletePromotionUseCase } from './application/use-cases/DeletePromotionUseCase';
import { ListPromotionsUseCase } from './application/use-cases/ListPromotionsUseCase';
import { CreateCouponUseCase } from './application/use-cases/CreateCouponUseCase';
import { UpdateCouponUseCase } from './application/use-cases/UpdateCouponUseCase';
import { DeleteCouponUseCase } from './application/use-cases/DeleteCouponUseCase';
import { ListCouponsUseCase } from './application/use-cases/ListCouponsUseCase';
import { RedeemCouponUseCase } from './application/use-cases/RedeemCouponUseCase';

@Module({
  imports: [
    AgentRulesModule,
    PaymentModule,
    TenantModule,
    ContactModule,
    DatabaseModule,
    AuthModule,
  ],
  controllers: [SalesController],
  providers: [
    GetSalesMetricsUseCase,
    ListPaymentLinksUseCase,
    GenerateSalesPaymentLinksReportUseCase,
    PausePaymentLinkUseCase,
    ResumePaymentLinkUseCase,
    DeletePaymentLinkUseCase,
    SuggestPaymentLinkWithAIUseCase,
    CreateSplitPaymentChargeUseCase,
    CreatePromotionUseCase,
    UpdatePromotionUseCase,
    DeletePromotionUseCase,
    ListPromotionsUseCase,
    CreateCouponUseCase,
    UpdateCouponUseCase,
    DeleteCouponUseCase,
    ListCouponsUseCase,
    RedeemCouponUseCase,
    SalesPaymentLinkLifecycleService,
    SalesPaymentLinksReportCsvBuilder,
    SalesPaymentLinksSchemaService,
    TrackSalesMetricUseCase,
    SalesAnalyticsHandler,
    {
      provide: AI_ENGINE,
      useClass: DeepSeekAdapter,
    },
    {
      provide: ICreatePaymentLinkUseCase,
      useClass: CreatePaymentLinkUseCase,
    },
    {
      provide: PrismaSalesRepository,
      useClass: PrismaSalesRepository,
    },
    {
      provide: SALES_REPOSITORY,
      useExisting: PrismaSalesRepository,
    },
    {
      provide: SALES_METRICS_REPOSITORY,
      useExisting: PrismaSalesRepository,
    },
    {
      provide: SALES_PAYMENT_LINKS_REPOSITORY,
      useExisting: PrismaSalesRepository,
    },
    {
      provide: SALES_PROMOTION_REPOSITORY,
      useExisting: PrismaSalesRepository,
    },
    {
      provide: SALES_COUPON_REPOSITORY,
      useExisting: PrismaSalesRepository,
    },
  ],
  exports: [ICreatePaymentLinkUseCase, TrackSalesMetricUseCase, SALES_REPOSITORY],
})
export class SalesModule { }
