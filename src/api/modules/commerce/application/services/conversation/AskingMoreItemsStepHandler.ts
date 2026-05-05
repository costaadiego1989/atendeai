import { Inject, Injectable } from '@nestjs/common';
import {
  COMMERCE_REPOSITORY,
  ICommerceRepository,
} from '../../../domain/ports/ICommerceRepository';
import { CommerceConversationHandlerContext } from './CommerceConversationHandlerContext';
import { CommerceConversationFlowRules } from './CommerceConversationFlowRules';
import { CommerceConversationSearchService } from './CommerceConversationSearchService';

@Injectable()
export class AskingMoreItemsStepHandler {
  constructor(
    @Inject(COMMERCE_REPOSITORY)
    private readonly commerceRepository: ICommerceRepository,
    private readonly conversationFlowRules: CommerceConversationFlowRules,
    private readonly conversationSearchService: CommerceConversationSearchService,
  ) {}

  async handle({
    input,
    session,
    userMessage,
    normalizedMessage,
  }: CommerceConversationHandlerContext) {
    if (this.conversationFlowRules.isNegativeOrCheckout(normalizedMessage)) {
      return this.commerceRepository.updateSessionState({
        tenantId: input.tenantId,
        sessionId: session.id,
        currentStep: 'AWAITING_FULFILLMENT',
        pendingQuery: null,
        pendingOptions: [],
      });
    }

    const matches = await this.conversationSearchService.searchCatalog(
      input.tenantId,
      userMessage,
    );
    if (!matches.length) {
      return this.commerceRepository.updateSessionState({
        tenantId: input.tenantId,
        sessionId: session.id,
        currentStep: 'IDENTIFYING_NEED',
      });
    }

    return this.commerceRepository.updateSessionState({
      tenantId: input.tenantId,
      sessionId: session.id,
      currentStep: 'SELECTING_ITEM',
      pendingQuery: userMessage,
      pendingOptions: matches,
    });
  }
}
