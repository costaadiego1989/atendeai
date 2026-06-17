import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  COMMERCE_REPOSITORY,
  ICommerceRepository,
} from '../../domain/ports/ICommerceRepository';
import { StartShoppingSessionUseCase } from './StartShoppingSessionUseCase';
import { CommerceConversationFlowRules } from '../services/conversation/CommerceConversationFlowRules';
import { CommerceConversationSearchService } from '../services/conversation/CommerceConversationSearchService';
import { IdentifyNeedStepHandler } from '../services/conversation/IdentifyNeedStepHandler';
import { SelectingItemStepHandler } from '../services/conversation/SelectingItemStepHandler';
import { AwaitingQuantityStepHandler } from '../services/conversation/AwaitingQuantityStepHandler';
import { AskingMoreItemsStepHandler } from '../services/conversation/AskingMoreItemsStepHandler';
import { AwaitingFulfillmentStepHandler } from '../services/conversation/AwaitingFulfillmentStepHandler';
import { AwaitingShippingMethodStepHandler } from '../services/conversation/AwaitingShippingMethodStepHandler';
import { AwaitingCarrierCepStepHandler } from '../services/conversation/AwaitingCarrierCepStepHandler';
import { AwaitingCarrierOptionStepHandler } from '../services/conversation/AwaitingCarrierOptionStepHandler';
import { AwaitingDeliveryAddressStepHandler } from '../services/conversation/AwaitingDeliveryAddressStepHandler';
import { AwaitingOrderNoteStepHandler } from '../services/conversation/AwaitingOrderNoteStepHandler';
import { ReadyForCheckoutStepHandler } from '../services/conversation/ReadyForCheckoutStepHandler';
import { ApplyCouponToShoppingSessionUseCase } from './ApplyCouponToShoppingSessionUseCase';

export interface AdvanceCommerceConversationInput {
  tenantId: string;
  branchId?: string | null;
  conversationId: string;
  contactId?: string | null;
  businessType?: string | null;
  userMessage: string;
}

@Injectable()
export class AdvanceCommerceConversationUseCase {
  private readonly logger = new Logger(AdvanceCommerceConversationUseCase.name);

  constructor(
    @Inject(COMMERCE_REPOSITORY)
    private readonly commerceRepository: ICommerceRepository,
    private readonly startShoppingSessionUseCase: StartShoppingSessionUseCase,
    private readonly applyCouponToShoppingSessionUseCase: ApplyCouponToShoppingSessionUseCase,
    private readonly conversationFlowRules: CommerceConversationFlowRules,
    private readonly conversationSearchService: CommerceConversationSearchService,
    private readonly identifyNeedStepHandler: IdentifyNeedStepHandler,
    private readonly selectingItemStepHandler: SelectingItemStepHandler,
    private readonly awaitingQuantityStepHandler: AwaitingQuantityStepHandler,
    private readonly askingMoreItemsStepHandler: AskingMoreItemsStepHandler,
    private readonly awaitingFulfillmentStepHandler: AwaitingFulfillmentStepHandler,
    private readonly awaitingShippingMethodStepHandler: AwaitingShippingMethodStepHandler,
    private readonly awaitingCarrierCepStepHandler: AwaitingCarrierCepStepHandler,
    private readonly awaitingCarrierOptionStepHandler: AwaitingCarrierOptionStepHandler,
    private readonly awaitingDeliveryAddressStepHandler: AwaitingDeliveryAddressStepHandler,
    private readonly awaitingOrderNoteStepHandler: AwaitingOrderNoteStepHandler,
    private readonly readyForCheckoutStepHandler: ReadyForCheckoutStepHandler,
  ) {}

  async execute(input: AdvanceCommerceConversationInput) {
    if (
      !this.conversationFlowRules.isTransactionalBusiness(input.businessType)
    ) {
      return null;
    }

    let session = await this.commerceRepository.findActiveSessionByConversation(
      input.tenantId,
      input.conversationId,
    );

    const userMessage = input.userMessage.trim();
    const normalizedMessage = this.conversationFlowRules.normalize(userMessage);

    if (!session) {
      const initialMatches = await this.conversationSearchService.searchCatalog(
        input.tenantId,
        userMessage,
      );
      if (initialMatches.length === 0) {
        return null;
      }

      session = await this.startShoppingSessionUseCase.execute({
        tenantId: input.tenantId,
        branchId: input.branchId,
        conversationId: input.conversationId,
        contactId: input.contactId,
      });

      return this.commerceRepository.updateSessionState({
        tenantId: input.tenantId,
        sessionId: session.id,
        currentStep: 'SELECTING_ITEM',
        pendingQuery: userMessage,
        pendingOptions: initialMatches,
      });
    }

    if (
      session &&
      this.conversationFlowRules.isResetIntent(normalizedMessage)
    ) {
      return this.commerceRepository.updateSessionState({
        tenantId: input.tenantId,
        sessionId: session.id,
        status: 'CANCELLED',
        currentStep: 'CANCELLED',
        pendingOptions: [],
        pendingQuery: null,
        selectedSource: null,
        selectedInventoryItemId: null,
        selectedCatalogItemId: null,
        selectedItemName: null,
      });
    }

    if (session) {
      const couponMatch = input.userMessage.match(/\bcupom[:\s]+(\w+)\b/i);
      if (couponMatch) {
        const couponCode = couponMatch[1];
        try {
          return await this.applyCouponToShoppingSessionUseCase.execute({
            tenantId: input.tenantId,
            sessionId: session.id,
            code: couponCode,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);

          this.logger.warn(
            `Coupon application failed; continuing conversation flow: ${message}`,
            {
              tenantId: input.tenantId,
              sessionId: session.id,
              code: couponCode,
            },
          );

          session = {
            ...session,
            warning: {
              type: 'COUPON_APPLICATION_FAILED',
              code: couponCode,
              message,
            },
          };
        }
      }
    }

    const context = {
      input,
      session,
      userMessage,
      normalizedMessage,
    };

    switch (session.currentStep) {
      case 'IDENTIFYING_NEED':
        return this.identifyNeedStepHandler.handle(context);
      case 'SELECTING_ITEM':
        return this.selectingItemStepHandler.handle(context);
      case 'AWAITING_QUANTITY':
        return this.awaitingQuantityStepHandler.handle(context);
      case 'ASKING_MORE_ITEMS':
        return this.askingMoreItemsStepHandler.handle(context);
      case 'AWAITING_FULFILLMENT':
        return this.awaitingFulfillmentStepHandler.handle(context);
      case 'AWAITING_SHIPPING_METHOD':
        return this.awaitingShippingMethodStepHandler.handle(context);
      case 'AWAITING_CARRIER_CEP':
        return this.awaitingCarrierCepStepHandler.handle(context);
      case 'AWAITING_CARRIER_OPTION':
        return this.awaitingCarrierOptionStepHandler.handle(context);
      case 'AWAITING_DELIVERY_ADDRESS':
        return this.awaitingDeliveryAddressStepHandler.handle(context);
      case 'AWAITING_ORDER_NOTE':
        return this.awaitingOrderNoteStepHandler.handle(context);
      case 'READY_FOR_CHECKOUT':
        return this.readyForCheckoutStepHandler.handle(context);
      case 'AWAITING_PAYMENT':
      case 'AWAITING_FREIGHT_REVIEW':
      case 'PAID':
      case 'CANCELLED':
      default:
        return session;
    }
  }
}
