import { Inject, Injectable } from '@nestjs/common';
import {
  COMMERCE_REPOSITORY,
  ICommerceRepository,
} from '../../../domain/ports/ICommerceRepository';
import { CommerceConversationHandlerContext } from './CommerceConversationHandlerContext';
import { CommerceConversationFlowRules } from './CommerceConversationFlowRules';

/**
 * Handles the AWAITING_CARRIER_OPTION step.
 * The customer selects one of the carrier shipping options presented.
 * Stores the selected option and transitions to AWAITING_ORDER_NOTE.
 */
@Injectable()
export class AwaitingCarrierOptionStepHandler {
  constructor(
    @Inject(COMMERCE_REPOSITORY)
    private readonly commerceRepository: ICommerceRepository,
    private readonly conversationFlowRules: CommerceConversationFlowRules,
  ) {}

  async handle({
    input,
    session,
    normalizedMessage,
  }: CommerceConversationHandlerContext) {
    const selectedOption = this.conversationFlowRules.resolveSelectedOption(
      session.pendingOptions,
      normalizedMessage,
    );

    if (!selectedOption) {
      // Could not parse selection — stay on same step
      return session;
    }

    const attributes = (selectedOption.attributes ?? {}) as Record<
      string,
      unknown
    >;
    const serviceCode = String(attributes.serviceCode ?? '');
    const serviceName = String(attributes.serviceName ?? selectedOption.name);
    const deliveryDays = Number(attributes.deliveryDays ?? 0);
    const freightAmount = selectedOption.price ?? 0;

    // Calculate totals with the selected freight
    const subtotalAmount = session.items.reduce(
      (total, item) => total + Number(item.lineTotal),
      0,
    );
    const discountAmount = session.discountAmount ?? 0;
    const totalAmount = subtotalAmount + freightAmount - discountAmount;

    return this.commerceRepository.updateSessionState({
      tenantId: input.tenantId,
      sessionId: session.id,
      currentStep: 'AWAITING_ORDER_NOTE',
      carrierServiceCode: serviceCode,
      carrierServiceName: serviceName,
      carrierDeliveryDays: deliveryDays,
      freightAmount,
      subtotalAmount,
      totalAmount,
      pendingOptions: [],
    });
  }
}
