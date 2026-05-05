import { Inject, Injectable } from '@nestjs/common';
import {
  COMMERCE_REPOSITORY,
  ICommerceRepository,
} from '../../../domain/ports/ICommerceRepository';
import { CommerceConversationHandlerContext } from './CommerceConversationHandlerContext';
import { CommerceConversationFlowRules } from './CommerceConversationFlowRules';
import { CommerceConversationSearchService } from './CommerceConversationSearchService';

@Injectable()
export class SelectingItemStepHandler {
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
    const selectedOption = this.conversationFlowRules.resolveSelectedOption(
      session.pendingOptions,
      normalizedMessage,
    );

    if (selectedOption) {
      return this.commerceRepository.updateSessionState({
        tenantId: input.tenantId,
        sessionId: session.id,
        currentStep: 'AWAITING_QUANTITY',
        selectedSource: selectedOption.source,
        selectedInventoryItemId: selectedOption.inventoryItemId ?? null,
        selectedCatalogItemId: selectedOption.catalogItemId ?? null,
        selectedItemName: selectedOption.name,
      });
    }

    const matches = await this.conversationSearchService.searchCatalog(
      input.tenantId,
      userMessage,
    );
    if (!matches.length) {
      return session;
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
