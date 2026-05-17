import { Inject, Injectable } from '@nestjs/common';
import {
  COMMERCE_REPOSITORY,
  ICommerceRepository,
} from '../../../domain/ports/ICommerceRepository';
import { AddItemToShoppingSessionUseCase } from '../../use-cases/AddItemToShoppingSessionUseCase';
import { CommerceConversationHandlerContext } from './CommerceConversationHandlerContext';
import { CommerceConversationFlowRules } from './CommerceConversationFlowRules';

@Injectable()
export class AwaitingQuantityStepHandler {
  constructor(
    @Inject(COMMERCE_REPOSITORY)
    private readonly commerceRepository: ICommerceRepository,
    private readonly addItemToShoppingSessionUseCase: AddItemToShoppingSessionUseCase,
    private readonly conversationFlowRules: CommerceConversationFlowRules,
  ) {}

  async handle({
    input,
    session,
    normalizedMessage,
  }: CommerceConversationHandlerContext) {
    const quantity =
      this.conversationFlowRules.extractPositiveInteger(normalizedMessage);
    if (quantity == null) {
      return session;
    }

    const updatedSession = await this.addItemToShoppingSessionUseCase.execute({
      tenantId: input.tenantId,
      sessionId: session.id,
      inventoryItemId:
        session.selectedSource === 'INVENTORY'
          ? (session.selectedInventoryItemId ?? undefined)
          : undefined,
      catalogItemId:
        session.selectedSource === 'CATALOG'
          ? (session.selectedCatalogItemId ?? undefined)
          : undefined,
      quantity,
    });

    return this.commerceRepository.updateSessionState({
      tenantId: input.tenantId,
      sessionId: updatedSession.id,
      currentStep: 'ASKING_MORE_ITEMS',
      pendingQuery: null,
      pendingOptions: [],
      selectedSource: null,
      selectedInventoryItemId: null,
      selectedCatalogItemId: null,
      selectedItemName: null,
    });
  }
}
