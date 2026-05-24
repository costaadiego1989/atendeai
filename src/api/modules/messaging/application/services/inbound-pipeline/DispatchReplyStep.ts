import { Injectable } from '@nestjs/common';
import { IntegrationEvent } from '@shared/infrastructure/event-bus';
import { DomainException } from '@shared/domain/exceptions/DomainExceptions';
import { MessageReceivedIntegrationEvent } from '../../integration-events/publishers/MessageReceivedIntegrationEvent';
import { ConversationCreatedIntegrationEvent } from '../../integration-events/publishers/ConversationCreatedIntegrationEvent';
import { InboundMessageContext } from './InboundMessageContext';

@Injectable()
export class DispatchReplyStep {
  async execute(ctx: InboundMessageContext): Promise<InboundMessageContext> {
    if (!ctx.conversation || !ctx.message || !ctx.contactId) {
      throw new DomainException(
        'DispatchReplyStep requires a resolved conversation, message and contact in the pipeline context',
        'INBOUND_PIPELINE_CONTEXT_INCOMPLETE',
      );
    }

    const events: IntegrationEvent[] = [...ctx.events];
    const conversation = ctx.conversation;
    const message = ctx.message;
    const contactId = ctx.contactId;
    const contentType = ctx.input.contentType.toUpperCase();

    if (ctx.isNewConversation) {
      events.push(
        new ConversationCreatedIntegrationEvent(
          {
            tenantId: ctx.input.tenantId,
            conversationId: conversation.id.toString(),
            contactId,
            channel: ctx.input.channel,
          },
          `messaging:conv-created:${conversation.id.toString()}`,
        ),
      );
    }

    events.push(
      new MessageReceivedIntegrationEvent(
        {
          conversationId: conversation.id.toString(),
          tenantId: ctx.input.tenantId,
          contactId,
          branchId: ctx.branchId ?? null,
          messageId: message.id.toString(),
          content: {
            type: contentType,
            ...(ctx.input.content.text ? { text: ctx.input.content.text } : {}),
            ...(ctx.input.content.url ? { url: ctx.input.content.url } : {}),
            ...(ctx.input.content.mimeType
              ? { mimeType: ctx.input.content.mimeType }
              : {}),
            ...(ctx.input.content.fileName
              ? { fileName: ctx.input.content.fileName }
              : {}),
          },
          channel: ctx.input.channel,
        },
        `messaging:inbound:${ctx.input.externalMessageId}`,
      ),
    );

    return { ...ctx, events };
  }
}
