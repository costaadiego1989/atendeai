import { Inject, Injectable } from '@nestjs/common';
import {
  CONVERSATION_REPOSITORY,
  IConversationRepository,
} from '../../domain/repositories/IConversationRepository';
import {
  IMarkConversationReadUseCase,
  MarkConversationReadInput,
  MarkConversationReadOutput,
} from './interfaces/IMarkConversationReadUseCase';

@Injectable()
export class MarkConversationReadUseCase implements IMarkConversationReadUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: IConversationRepository,
  ) {}

  async execute(
    input: MarkConversationReadInput,
  ): Promise<MarkConversationReadOutput> {
    await this.conversationRepository.markAsRead(
      input.tenantId,
      input.conversationId,
    );

    return { success: true };
  }
}
