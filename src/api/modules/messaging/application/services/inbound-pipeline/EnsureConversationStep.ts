import { Inject, Injectable } from '@nestjs/common';
import {
  IConversationRepository,
  CONVERSATION_REPOSITORY,
} from '../../../domain/repositories/IConversationRepository';
import { Conversation } from '../../../domain/entities/Conversation';
import { TenantId } from '../../../../../shared/domain/TenantId';
import { UniqueEntityID } from '../../../../../shared/domain/UniqueEntityID';
import { InboundMessageContext } from './InboundMessageContext';

@Injectable()
export class EnsureConversationStep {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: IConversationRepository,
  ) {}

  async execute(ctx: InboundMessageContext): Promise<InboundMessageContext> {
    const tenantId = TenantId.create(ctx.input.tenantId);

    let conversation = await this.conversationRepository.findLatestByContact(
      tenantId.toString(),
      ctx.contactId!,
    );

    let shouldReleaseAssignment = false;
    let isNewConversation = false;

    if (!conversation) {
      conversation = Conversation.create({
        tenantId,
        contactId: new UniqueEntityID(ctx.contactId!),
        branchId: ctx.branchId ?? null,
        channel: ctx.input.channel,
      });
      isNewConversation = true;
    } else if (conversation.status === 'ARCHIVED') {
      conversation.activate();
      shouldReleaseAssignment = true;
    }

    return { ...ctx, conversation, isNewConversation, shouldReleaseAssignment };
  }
}
