import { Inject, Injectable } from '@nestjs/common';
import {
  COMMERCE_REPOSITORY,
  ICommerceRepository,
} from '../../../domain/ports/ICommerceRepository';
import { CheckoutShoppingSessionUseCase } from '../../use-cases/CheckoutShoppingSessionUseCase';
import { CommerceConversationHandlerContext } from './CommerceConversationHandlerContext';
import { CommerceConversationFlowRules } from './CommerceConversationFlowRules';

@Injectable()
export class AwaitingOrderNoteStepHandler {
  constructor(
    @Inject(COMMERCE_REPOSITORY)
    private readonly commerceRepository: ICommerceRepository,
    private readonly checkoutShoppingSessionUseCase: CheckoutShoppingSessionUseCase,
    private readonly conversationFlowRules: CommerceConversationFlowRules,
  ) {}

  async handle({
    input,
    session,
    userMessage,
    normalizedMessage,
  }: CommerceConversationHandlerContext) {
    const treatAsNoNote =
      this.conversationFlowRules.isSkipOrderNote(normalizedMessage) ||
      this.conversationFlowRules.isPaymentIntent(normalizedMessage);

    const updated = await this.commerceRepository.updateSessionState({
      tenantId: input.tenantId,
      sessionId: session.id,
      currentStep: 'READY_FOR_CHECKOUT',
      notes: treatAsNoNote ? null : userMessage,
    });

    if (
      !this.conversationFlowRules.isPaymentIntent(normalizedMessage) ||
      updated.paymentLinkUrl
    ) {
      return updated;
    }

    const checkout = await this.checkoutShoppingSessionUseCase.execute({
      tenantId: input.tenantId,
      sessionId: updated.id,
      billingType: 'PIX',
      paymentLinkName: 'Pedido conversacional',
    });

    return this.commerceRepository.updateSessionState({
      tenantId: input.tenantId,
      sessionId: checkout.session.id,
      currentStep: 'AWAITING_PAYMENT',
    });
  }
}
