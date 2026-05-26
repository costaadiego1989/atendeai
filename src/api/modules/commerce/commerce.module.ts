import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/auth.module';
import { MessagingModule } from '@modules/messaging/messaging.module';
import { CatalogModule } from '@modules/catalog/catalog.module';
import { ContactModule } from '@modules/contact/contact.module';
import { InventoryModule } from '@modules/inventory/inventory.module';
import { PaymentModule } from '@modules/payment/payment.module';
import { SalesModule } from '@modules/sales/sales.module';
import { ApplyCouponToShoppingSessionUseCase } from './application/use-cases/ApplyCouponToShoppingSessionUseCase';
import { CommerceController } from './presentation/controllers/CommerceController';
import { CommerceShippingController } from './presentation/controllers/CommerceShippingController';
import { CommerceOrdersController } from './presentation/controllers/CommerceOrdersController';
import { CommerceAbandonmentController } from './presentation/controllers/CommerceAbandonmentController';
import { ConfigureShippingPolicyUseCase } from './application/use-cases/ConfigureShippingPolicyUseCase';
import { GetShippingPolicyUseCase } from './application/use-cases/GetShippingPolicyUseCase';
import { SearchCommerceCatalogUseCase } from './application/use-cases/SearchCommerceCatalogUseCase';
import { StartShoppingSessionUseCase } from './application/use-cases/StartShoppingSessionUseCase';
import { GetShoppingSessionUseCase } from './application/use-cases/GetShoppingSessionUseCase';
import { AddItemToShoppingSessionUseCase } from './application/use-cases/AddItemToShoppingSessionUseCase';
import { UpdateShoppingSessionFulfillmentUseCase } from './application/use-cases/UpdateShoppingSessionFulfillmentUseCase';
import { CheckoutShoppingSessionUseCase } from './application/use-cases/CheckoutShoppingSessionUseCase';
import { AdvanceCommerceConversationUseCase } from './application/use-cases/AdvanceCommerceConversationUseCase';
import { ListCommerceOrdersUseCase } from './application/use-cases/ListCommerceOrdersUseCase';
import { GetCommerceOrderDetailsUseCase } from './application/use-cases/GetCommerceOrderDetailsUseCase';
import { UpdateCommerceOrderStatusUseCase } from './application/use-cases/UpdateCommerceOrderStatusUseCase';
import { SetOrderTrackingCodeUseCase } from './application/use-cases/SetOrderTrackingCodeUseCase';
import { RepeatLastOrderUseCase } from './application/use-cases/RepeatLastOrderUseCase';
import { DetectAbandonedShoppingSessionsUseCase } from './application/use-cases/DetectAbandonedShoppingSessionsUseCase';
import { UpdateCommerceAbandonmentStateUseCase } from './application/use-cases/UpdateCommerceAbandonmentStateUseCase';
import { TriggerCommerceAbandonmentTouchUseCase } from './application/use-cases/TriggerCommerceAbandonmentTouchUseCase';
import { GetAbandonmentConfigUseCase } from './application/use-cases/GetAbandonmentConfigUseCase';
import { UpdateAbandonmentConfigUseCase } from './application/use-cases/UpdateAbandonmentConfigUseCase';
import { GenerateAbandonmentMessageUseCase } from './application/use-cases/GenerateAbandonmentMessageUseCase';
import { COMMERCE_REPOSITORY } from './domain/ports/ICommerceRepository';
import { PrismaCommerceRepository } from './infrastructure/persistence/PrismaCommerceRepository';
import { CommercePaymentEventHandler } from './application/handlers/CommercePaymentEventHandler';
import { OrderTrackingNotificationHandler } from './application/handlers/OrderTrackingNotificationHandler';
import { CommerceConversationFlowRules } from './application/services/conversation/CommerceConversationFlowRules';
import { CommerceConversationSearchService } from './application/services/conversation/CommerceConversationSearchService';
import { CommerceOrdersReportCsvBuilder } from './application/services/CommerceOrdersReportCsvBuilder';
import { IdentifyNeedStepHandler } from './application/services/conversation/IdentifyNeedStepHandler';
import { SelectingItemStepHandler } from './application/services/conversation/SelectingItemStepHandler';
import { AwaitingQuantityStepHandler } from './application/services/conversation/AwaitingQuantityStepHandler';
import { AskingMoreItemsStepHandler } from './application/services/conversation/AskingMoreItemsStepHandler';
import { AwaitingFulfillmentStepHandler } from './application/services/conversation/AwaitingFulfillmentStepHandler';
import { AwaitingDeliveryAddressStepHandler } from './application/services/conversation/AwaitingDeliveryAddressStepHandler';
import { AwaitingOrderNoteStepHandler } from './application/services/conversation/AwaitingOrderNoteStepHandler';
import { ReadyForCheckoutStepHandler } from './application/services/conversation/ReadyForCheckoutStepHandler';

@Module({
  imports: [
    AuthModule,
    CatalogModule,
    ContactModule,
    InventoryModule,
    PaymentModule,
    SalesModule,
    forwardRef(() => MessagingModule),
  ],
  controllers: [
    CommerceController,
    CommerceShippingController,
    CommerceOrdersController,
    CommerceAbandonmentController,
  ],
  providers: [
    {
      provide: COMMERCE_REPOSITORY,
      useClass: PrismaCommerceRepository,
    },
    ConfigureShippingPolicyUseCase,
    GetShippingPolicyUseCase,
    SearchCommerceCatalogUseCase,
    StartShoppingSessionUseCase,
    GetShoppingSessionUseCase,
    AddItemToShoppingSessionUseCase,
    UpdateShoppingSessionFulfillmentUseCase,
    ApplyCouponToShoppingSessionUseCase,
    CheckoutShoppingSessionUseCase,
    CommerceConversationFlowRules,
    CommerceConversationSearchService,
    CommerceOrdersReportCsvBuilder,
    IdentifyNeedStepHandler,
    SelectingItemStepHandler,
    AwaitingQuantityStepHandler,
    AskingMoreItemsStepHandler,
    AwaitingFulfillmentStepHandler,
    AwaitingDeliveryAddressStepHandler,
    AwaitingOrderNoteStepHandler,
    ReadyForCheckoutStepHandler,
    AdvanceCommerceConversationUseCase,
    ListCommerceOrdersUseCase,
    GetCommerceOrderDetailsUseCase,
    UpdateCommerceOrderStatusUseCase,
    DetectAbandonedShoppingSessionsUseCase,
    UpdateCommerceAbandonmentStateUseCase,
    TriggerCommerceAbandonmentTouchUseCase,
    GetAbandonmentConfigUseCase,
    UpdateAbandonmentConfigUseCase,
    GenerateAbandonmentMessageUseCase,
    CommercePaymentEventHandler,
    OrderTrackingNotificationHandler,
    SetOrderTrackingCodeUseCase,
    RepeatLastOrderUseCase,
  ],
  exports: [
    COMMERCE_REPOSITORY,
    ConfigureShippingPolicyUseCase,
    GetShippingPolicyUseCase,
    SearchCommerceCatalogUseCase,
    StartShoppingSessionUseCase,
    GetShoppingSessionUseCase,
    AddItemToShoppingSessionUseCase,
    UpdateShoppingSessionFulfillmentUseCase,
    ApplyCouponToShoppingSessionUseCase,
    CheckoutShoppingSessionUseCase,
    AdvanceCommerceConversationUseCase,
    ListCommerceOrdersUseCase,
    GetCommerceOrderDetailsUseCase,
    UpdateCommerceOrderStatusUseCase,
    DetectAbandonedShoppingSessionsUseCase,
    UpdateCommerceAbandonmentStateUseCase,
    TriggerCommerceAbandonmentTouchUseCase,
    GetAbandonmentConfigUseCase,
    UpdateAbandonmentConfigUseCase,
    GenerateAbandonmentMessageUseCase,
    RepeatLastOrderUseCase,
  ],
})
export class CommerceModule {
  constructor(
    private readonly _commercePaymentEventHandler: CommercePaymentEventHandler,
    private readonly _orderTrackingNotificationHandler: OrderTrackingNotificationHandler,
  ) {}
}
