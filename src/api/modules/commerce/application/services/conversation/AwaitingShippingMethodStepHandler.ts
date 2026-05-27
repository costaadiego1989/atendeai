import { Inject, Injectable } from '@nestjs/common';
import {
  COMMERCE_REPOSITORY,
  ICommerceRepository,
} from '../../../domain/ports/ICommerceRepository';
import { CommerceConversationHandlerContext } from './CommerceConversationHandlerContext';
import { CommerceConversationFlowRules } from './CommerceConversationFlowRules';

/**
 * Handles the AWAITING_SHIPPING_METHOD step.
 * Presents "Entrega local" vs "Envio por transportadora" when tenant supports carrier shipping.
 * Routes to AWAITING_DELIVERY_ADDRESS (local) or AWAITING_CARRIER_CEP (carrier).
 */
@Injectable()
export class AwaitingShippingMethodStepHandler {
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
    const choice = this.parseShippingMethodChoice(normalizedMessage);

    if (choice === 'LOCAL') {
      // Route to local delivery flow (existing AWAITING_DELIVERY_ADDRESS)
      const shippingPolicy =
        await this.commerceRepository.findShippingPolicyByTenantId(
          input.tenantId,
        );

      return this.commerceRepository.updateSessionState({
        tenantId: input.tenantId,
        sessionId: session.id,
        currentStep:
          shippingPolicy?.mode === 'PER_KM'
            ? 'AWAITING_FREIGHT_REVIEW'
            : 'AWAITING_DELIVERY_ADDRESS',
        fulfillmentType: 'DELIVERY',
        shippingMode: shippingPolicy?.mode ?? 'FIXED',
      });
    }

    if (choice === 'CARRIER') {
      return this.commerceRepository.updateSessionState({
        tenantId: input.tenantId,
        sessionId: session.id,
        currentStep: 'AWAITING_CARRIER_CEP',
        fulfillmentType: 'DELIVERY',
        shippingMode: 'CARRIER',
      });
    }

    // Could not parse choice — stay on same step
    return session;
  }

  private parseShippingMethodChoice(
    normalizedMessage: string,
  ): 'LOCAL' | 'CARRIER' | null {
    // Option 1 = local delivery
    if (
      normalizedMessage === '1' ||
      normalizedMessage.includes('local') ||
      normalizedMessage.includes('motoboy') ||
      normalizedMessage.includes('entrega local')
    ) {
      return 'LOCAL';
    }

    // Option 2 = carrier shipping
    if (
      normalizedMessage === '2' ||
      normalizedMessage.includes('transportadora') ||
      normalizedMessage.includes('correios') ||
      normalizedMessage.includes('envio') ||
      normalizedMessage.includes('sedex') ||
      normalizedMessage.includes('pac')
    ) {
      return 'CARRIER';
    }

    return null;
  }
}
