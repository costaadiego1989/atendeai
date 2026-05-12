import { Injectable } from '@nestjs/common';
import { IntegrationEvent } from '@shared/infrastructure/event-bus';
import { MessageReceivedIntegrationEvent } from '../../integration-events/publishers/MessageReceivedIntegrationEvent';
import { ConversationCreatedIntegrationEvent } from '../../integration-events/publishers/ConversationCreatedIntegrationEvent';
import { InboundMessageContext } from './InboundMessageContext';

@Injectable()
export class DispatchReplyStep {
  async execute(ctx: InboundMessageContext): Promise<InboundMessageContext> {
    const events: IntegrationEvent[] = [...ctx.events];
    const conversation = ctx.conversation!;
    const message = ctx.message!;
    const contentType = ctx.input.contentType.toUpperCase();

    if (ctx.isNewConversation) {
      events.push(
        new ConversationCreatedIntegrationEvent(
          {
            tenantId: ctx.input.tenantId,
            conversationId: conversation.id.toString(),
            contactId: ctx.contactId!,
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
          contactId: ctx.contactId!,
          branchId: ctx.branchId ?? null,
          messageId: message.id.toString(),
          content: {
            type: contentType,
            ...(ctx.input.content.text ? { text: ctx.input.content.text } : {}),
            ...(ctx.input.content.url ? { url: ctx.input.content.url } : {}),
            ...(ctx.input.content.mimeType ? { mimeType: ctx.input.content.mimeType } : {}),
            ...(ctx.input.content.fileName ? { fileName: ctx.input.content.fileName } : {}),
          },
          channel: ctx.input.channel,
        },
        `messaging:inbound:${ctx.input.externalMessageId}`,
      ),
    );

    return { ...ctx, events };
  }
}
