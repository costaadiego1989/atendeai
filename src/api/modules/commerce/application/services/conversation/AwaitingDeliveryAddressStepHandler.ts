import { Inject, Injectable } from '@nestjs/common';
import {
  COMMERCE_REPOSITORY,
  ICommerceRepository,
} from '../../../domain/ports/ICommerceRepository';
import { UpdateShoppingSessionFulfillmentUseCase } from '../../use-cases/UpdateShoppingSessionFulfillmentUseCase';
import { CommerceConversationHandlerContext } from './CommerceConversationHandlerContext';
import { CommerceConversationFlowRules } from './CommerceConversationFlowRules';

@Injectable()
export class AwaitingDeliveryAddressStepHandler {
  constructor(
    @Inject(COMMERCE_REPOSITORY)
    private readonly commerceRepository: ICommerceRepository,
    private readonly updateShoppingSessionFulfillmentUseCase: UpdateShoppingSessionFulfillmentUseCase,
    private readonly conversationFlowRules: CommerceConversationFlowRules,
  ) {}

  async handle({ input, session, userMessage }: CommerceConversationHandlerContext) {
    const shippingPolicy =
      await this.commerceRepository.findShippingPolicyByTenantId(input.tenantId);

    if (
      !shippingPolicy ||
      shippingPolicy.mode !== 'FIXED' ||
      !this.conversationFlowRules.looksLikeAddress(userMessage)
    ) {
      return session;
    }

    const updated = await this.updateShoppingSessionFulfillmentUseCase.execute({
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
}
