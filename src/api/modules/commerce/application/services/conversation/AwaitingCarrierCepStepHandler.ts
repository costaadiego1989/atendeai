import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  COMMERCE_REPOSITORY,
  ICommerceRepository,
} from '../../../domain/ports/ICommerceRepository';
import {
  BRANCH_ORIGIN_CEP_PORT,
  IBranchOriginCepPort,
} from '../../../domain/ports/IBranchOriginCepPort';
import { QuoteCarrierShippingUseCase } from '../../use-cases/QuoteCarrierShippingUseCase';
import { CommerceConversationHandlerContext } from './CommerceConversationHandlerContext';

/**
 * Handles the AWAITING_CARRIER_CEP step.
 * Validates the customer's CEP, fetches shipping quotes, and transitions
 * to AWAITING_CARRIER_OPTION with the available options stored as pendingOptions.
 */
@Injectable()
export class AwaitingCarrierCepStepHandler {
  private readonly logger = new Logger(AwaitingCarrierCepStepHandler.name);

  constructor(
    @Inject(COMMERCE_REPOSITORY)
    private readonly commerceRepository: ICommerceRepository,
    @Inject(BRANCH_ORIGIN_CEP_PORT)
    private readonly branchOriginCepPort: IBranchOriginCepPort,
    private readonly quoteCarrierShippingUseCase: QuoteCarrierShippingUseCase,
  ) {}

  async handle({
    input,
    session,
    userMessage,
  }: CommerceConversationHandlerContext) {
    const cep = this.extractCep(userMessage);

    if (!cep) {
      // Invalid CEP — stay on same step
      return session;
    }

    const originCep = await this.branchOriginCepPort.getOriginCep(
      input.tenantId,
      session.branchId,
    );

    if (!originCep) {
      this.logger.warn(
        `No origin CEP configured for tenant ${input.tenantId}, branch ${session.branchId}`,
      );
      // Cannot quote without origin — stay on same step
      return session;
    }

    // Build items with weight/dimensions from session items
    // For now, use defaults since items don't carry weight yet in session record
    const items = session.items.map((item) => ({
      weightGrams: null as number | null,
      heightCm: null as number | null,
      widthCm: null as number | null,
      lengthCm: null as number | null,
      quantity: item.quantity,
    }));

    const quoteResult = await this.quoteCarrierShippingUseCase.execute({
      originCep,
      destinationCep: cep,
      items,
    });

    if (quoteResult.options.length === 0) {
      // No shipping options available — store CEP but stay on step
      // The AI layer will inform the customer
      return this.commerceRepository.updateSessionState({
        tenantId: input.tenantId,
        sessionId: session.id,
        carrierCep: cep,
        pendingOptions: [],
      });
    }

    // Store options as pendingOptions for the next step to present
    const carrierOptions = quoteResult.options.map((opt, index) => ({
      optionNumber: index + 1,
      source: 'CATALOG' as const,
      name: `${opt.serviceName} (${opt.carrierName}) — R$ ${opt.price.toFixed(2)} — ${opt.deliveryDays} dias úteis`,
      price: opt.price,
      currency: 'BRL',
      availableQuantity: null,
      availabilityStatus: null,
      categoryName: null,
      attributes: {
        serviceCode: opt.serviceCode,
        serviceName: opt.serviceName,
        carrierName: opt.carrierName,
        deliveryDays: opt.deliveryDays,
      },
    }));

    return this.commerceRepository.updateSessionState({
      tenantId: input.tenantId,
      sessionId: session.id,
      currentStep: 'AWAITING_CARRIER_OPTION',
      carrierCep: cep,
      pendingOptions: carrierOptions,
    });
  }

  /**
   * Extracts and validates a Brazilian CEP from user message.
   * Accepts formats: 12345678, 12345-678, 12.345-678
   */
  private extractCep(message: string): string | null {
    const cleaned = message.replace(/[\s.\-]/g, '');
    const match = cleaned.match(/(\d{8})/);

    if (!match) {
      return null;
    }

    const cep = match[1];

    // Basic validation: Brazilian CEPs range from 01000-000 to 99999-999
    const numericCep = parseInt(cep, 10);
    if (numericCep < 1000000 || numericCep > 99999999) {
      return null;
    }

    return cep;
  }
}
