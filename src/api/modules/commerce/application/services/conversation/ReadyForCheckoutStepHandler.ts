import { Inject, Injectable } from '@nestjs/common';
import {
  COMMERCE_REPOSITORY,
  ICommerceRepository,
} from '../../../domain/ports/ICommerceRepository';
import { CheckoutShoppingSessionUseCase } from '../../use-cases/CheckoutShoppingSessionUseCase';
import { CommerceConversationHandlerContext } from './CommerceConversationHandlerContext';
import { CommerceConversationFlowRules } from './CommerceConversationFlowRules';

@Injectable()
export class ReadyForCheckoutStepHandler {
  constructor(
    @Inject(COMMERCE_REPOSITORY)
    private readonly commerceRepository: ICommerceRepository,
    private readonly checkoutShoppingSessionUseCase: CheckoutShoppingSessionUseCase,
    private readonly conversationFlowRules: CommerceConversationFlowRules,
  ) {}

  async handle({
    input,
    session,
    normalizedMessage,
  }: CommerceConversationHandlerContext) {
    if (
      !this.conversationFlowRules.isPaymentIntent(normalizedMessage) ||
      session.paymentLinkUrl
    ) {
      return session;
    }

    const checkout = await this.checkoutShoppingSessionUseCase.execute({
      tenantId: input.tenantId,
      sessionId: session.id,
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
