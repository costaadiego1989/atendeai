import { Inject, Injectable } from '@nestjs/common';
import {
  COMMERCE_REPOSITORY,
  ICommerceRepository,
} from '../../../domain/ports/ICommerceRepository';
import { UpdateShoppingSessionFulfillmentUseCase } from '../../use-cases/UpdateShoppingSessionFulfillmentUseCase';
import { CommerceConversationHandlerContext } from './CommerceConversationHandlerContext';
import { CommerceConversationFlowRules } from './CommerceConversationFlowRules';

@Injectable()
export class AwaitingFulfillmentStepHandler {
  constructor(
    @Inject(COMMERCE_REPOSITORY)
    private readonly commerceRepository: ICommerceRepository,
    private readonly updateShoppingSessionFulfillmentUseCase: UpdateShoppingSessionFulfillmentUseCase,
    private readonly conversationFlowRules: CommerceConversationFlowRules,
  ) {}

  async handle({
    input,
    session,
    userMessage,
    normalizedMessage,
  }: CommerceConversationHandlerContext) {
    if (this.conversationFlowRules.isPickup(normalizedMessage)) {
      const updated =
        await this.updateShoppingSessionFulfillmentUseCase.execute({
          tenantId: input.tenantId,
          sessionId: session.id,
          fulfillmentType: 'PICKUP',
        });

      return this.commerceRepository.updateSessionState({
        tenantId: input.tenantId,
        sessionId: updated.id,
        currentStep: 'AWAITING_ORDER_NOTE',
      });
    }

    if (this.conversationFlowRules.isDelivery(normalizedMessage)) {
      const shippingPolicy =
        await this.commerceRepository.findShippingPolicyByTenantId(
          input.tenantId,
        );

      // If tenant supports carrier shipping, route to shipping method selection
      if (shippingPolicy?.carrierShippingEnabled) {
        return this.commerceRepository.updateSessionState({
          tenantId: input.tenantId,
          sessionId: session.id,
          currentStep: 'AWAITING_SHIPPING_METHOD',
          fulfillmentType: 'DELIVERY',
        });
      }

      if (
        shippingPolicy?.mode === 'FIXED' &&
        this.conversationFlowRules.looksLikeAddress(userMessage)
      ) {
        const updated =
          await this.updateShoppingSessionFulfillmentUseCase.execute({
            tenantId: input.tenantId,
            sessionId: session.id,
            fulfillmentType: 'DELIVERY',
            deliveryAddress: userMessage,
          });

        return this.commerceRepository.updateSessionState({
          tenantId: input.tenantId,
          sessionId: updated.id,
          currentStep: 'AWAITING_ORDER_NOTE',
        });
      }

      return this.commerceRepository.updateSessionState({
        tenantId: input.tenantId,
        sessionId: session.id,
        currentStep:
          shippingPolicy?.mode === 'PER_KM'
            ? 'AWAITING_FREIGHT_REVIEW'
            : 'AWAITING_DELIVERY_ADDRESS',
        fulfillmentType: 'DELIVERY',
        shippingMode: shippingPolicy?.mode ?? null,
      });
    }

    return session;
  }
}
