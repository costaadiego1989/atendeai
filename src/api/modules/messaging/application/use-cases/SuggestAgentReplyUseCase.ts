import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ISuggestAgentReplyUseCase,
  SuggestAgentReplyInput,
  SuggestAgentReplyOutput,
} from './interfaces/ISuggestAgentReplyUseCase';
import {
  IConversationRepository,
  CONVERSATION_REPOSITORY,
} from '../../domain/repositories/IConversationRepository';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '../../../tenant/domain/repositories/ITenantRepository';
import { SuggestAgentReplyService } from '../services/SuggestAgentReplyService';

@Injectable()
export class SuggestAgentReplyUseCase implements ISuggestAgentReplyUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: IConversationRepository,
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: ITenantRepository,
    private readonly suggestAgentReplyService: SuggestAgentReplyService,
  ) {}

  async execute(
    input: SuggestAgentReplyInput,
  ): Promise<SuggestAgentReplyOutput> {
    const conversation = await this.conversationRepository.findById(
      input.conversationId,
    );
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const tenant = await this.tenantRepository.findById(input.tenantId);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const result = await this.suggestAgentReplyService.generateSuggestion(
      input.tenantId,
      input.conversationId,
      conversation.contactId.toString(),
    );

    return {
      text: result.text,
    };
  }
}
