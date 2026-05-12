import { Inject, Injectable } from '@nestjs/common';
import {
  IConversationRepository,
  CONVERSATION_REPOSITORY,
} from '../../../domain/repositories/IConversationRepository';
import { InboundMessageContext } from './InboundMessageContext';

@Injectable()
export class DeduplicateMessageStep {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: IConversationRepository,
  ) {}

  async execute(ctx: InboundMessageContext): Promise<InboundMessageContext> {
    if (ctx.skipDuplicateCheck) {
      return { ...ctx, isDuplicate: false };
    }

    const existing =
      await this.conversationRepository.findByExternalMessageId(
        ctx.input.externalMessageId,
      );

    return { ...ctx, isDuplicate: !!existing };
  }
}
