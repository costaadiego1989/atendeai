import { Inject, Injectable } from '@nestjs/common';
import {
  COMMERCE_REPOSITORY,
  ICommerceRepository,
} from '../../../domain/ports/ICommerceRepository';
import { CommerceConversationHandlerContext } from './CommerceConversationHandlerContext';
import { CommerceConversationSearchService } from './CommerceConversationSearchService';

@Injectable()
export class IdentifyNeedStepHandler {
  constructor(
    @Inject(COMMERCE_REPOSITORY)
    private readonly commerceRepository: ICommerceRepository,
    private readonly conversationSearchService: CommerceConversationSearchService,
  ) {}

  async handle({
    input,
    session,
    userMessage,
  }: CommerceConversationHandlerContext) {
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
