import { Inject, Injectable } from '@nestjs/common';
import { PrismaTransactionalEventPublisher } from '@shared/infrastructure/event-bus/PrismaTransactionalEventPublisher';
import {
  IContactFacade,
  CONTACT_FACADE,
} from '@modules/contact/application/facades/ContactFacade';
import { MessageReceivedIntegrationEvent } from '../integration-events/publishers/MessageReceivedIntegrationEvent';
import { ConversationCreatedIntegrationEvent } from '../integration-events/publishers/ConversationCreatedIntegrationEvent';
import { IntegrationEvent } from '@shared/infrastructure/event-bus';
import { Prisma } from '@prisma/client';

export interface ProcessWidgetMessageInput {
  tenantId: string;
  widgetSessionId: string;
  visitorId: string;
  visitorName?: string | null;
  visitorPhone?: string | null;
  visitorEmail?: string | null;
  visitorCpf?: string | null;
  text: string;
  contentType?: 'text' | 'image' | 'audio';
  url?: string | null;
  quickReplies?: string[];
}

export interface ProcessWidgetMessageOutput {
  contactId: string;
  conversationId: string;
  messageId: string;
}

@Injectable()
export class ProcessWidgetMessageUseCase {
  constructor(
    private readonly transactionalEventPublisher: PrismaTransactionalEventPublisher,
    @Inject(CONTACT_FACADE)
    private readonly contactFacade: IContactFacade,
  ) {}

  async execute(
    input: ProcessWidgetMessageInput,
  ): Promise<ProcessWidgetMessageOutput> {
    const phone = input.visitorPhone?.trim() || `widget_${input.visitorId}`;
    const name = input.visitorName?.trim() || 'Visitante Web';

    const { contactId } = await this.contactFacade.identifyContact(
      input.tenantId,
      phone,
      name,
    );

    const result = await this.transactionalEventPublisher.execute<ProcessWidgetMessageOutput>(
      async (tx) => {
        const events: IntegrationEvent[] = [];

        let conversation = await (tx as Prisma.TransactionClient).conversation.findFirst({
          where: {
            tenantId: input.tenantId,
            contactId,
            channel: 'WEB_CHAT',
            status: { not: 'ARCHIVED' },
          },
          orderBy: { startedAt: 'desc' },
        });

        let isNewConversation = false;

        if (!conversation) {
          conversation = await (tx as Prisma.TransactionClient).conversation.create({
            data: {
              tenantId: input.tenantId,
              contactId,
              channel: 'WEB_CHAT',
              status: 'ACTIVE',
              lastMessageAt: new Date(),
              lastMessageDirection: 'INBOUND',
              lastMessagePreview: input.text.substring(0, 100),
              lastInboundAt: new Date(),
            },
          });
          isNewConversation = true;
        }

        const contentType = (input.contentType || 'text').toUpperCase();
        const message = await (tx as Prisma.TransactionClient).message.create({
          data: {
            conversationId: conversation.id,
            direction: 'INBOUND',
            contentType,
            content: { text: input.text, url: input.url ?? undefined },
            sentBy: 'CONTACT',
            deliveryStatus: 'DELIVERED',
          },
        });

        await (tx as Prisma.TransactionClient).conversation.update({
          where: { id: conversation.id },
          data: {
            lastMessageAt: new Date(),
            lastMessageDirection: 'INBOUND',
            lastMessagePreview: input.text.substring(0, 100),
            lastInboundAt: new Date(),
            unreadCount: { increment: 1 },
            status: 'ACTIVE',
          },
        });

        if (isNewConversation) {
          events.push(
            new ConversationCreatedIntegrationEvent(
              {
                tenantId: input.tenantId,
                conversationId: conversation.id,
                contactId,
                channel: 'WEB_CHAT',
              },
              `messaging:conv-created:${conversation.id}`,
            ),
          );
        }

        events.push(
          new MessageReceivedIntegrationEvent(
            {
              conversationId: conversation.id,
              tenantId: input.tenantId,
              contactId,
              branchId: null,
              messageId: message.id,
              content: {
                type: contentType,
                text: input.text,
                ...(input.url ? { url: input.url } : {}),
              },
              channel: 'WEB_CHAT',
              ...(input.quickReplies?.length ? { contextHints: input.quickReplies } : {}),
            },
            `messaging:inbound:${message.id}`,
          ),
        );

        return {
          result: {
            contactId,
            conversationId: conversation.id,
            messageId: message.id,
          } as ProcessWidgetMessageOutput,
          events,
        };
      },
    );

    return result;
  }
}
