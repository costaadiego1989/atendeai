import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaTransactionalEventPublisher } from '@shared/infrastructure/event-bus/PrismaTransactionalEventPublisher';
import {
  IContactFacade,
  CONTACT_FACADE,
} from '@modules/contact/application/facades/ContactFacade';
import { ConversationCreatedIntegrationEvent } from '../integration-events/publishers/ConversationCreatedIntegrationEvent';
import { MessageReceivedIntegrationEvent } from '../integration-events/publishers/MessageReceivedIntegrationEvent';
import { IntegrationEvent } from '@shared/infrastructure/event-bus';
import { Prisma } from '@prisma/client';

export interface InitiateWidgetContactInput {
  tenantId: string;
  visitorId: string;
  visitorName?: string | null;
  visitorPhone?: string | null;
  visitorEmail?: string | null;
  visitorCpf?: string | null;
  quickReplies?: string[];
}

export interface InitiateWidgetContactOutput {
  contactId: string;
  conversationId: string;
}

@Injectable()
export class InitiateWidgetContactUseCase {
  constructor(
    private readonly transactionalEventPublisher: PrismaTransactionalEventPublisher,
    @Inject(CONTACT_FACADE)
    private readonly contactFacade: IContactFacade,
  ) {}

  async execute(
    input: InitiateWidgetContactInput,
  ): Promise<InitiateWidgetContactOutput> {
    const phone =
      input.visitorPhone?.trim() ||
      `wgt_${createHash('sha256').update(input.visitorId).digest('hex').slice(0, 15)}`;
    const name = input.visitorName?.trim() || 'Visitante Web';

    const { contactId } = await this.contactFacade.ensureContact({
      tenantId: input.tenantId,
      name,
      phone,
      email: input.visitorEmail ?? undefined,
      document: input.visitorCpf ?? undefined,
      stage: 'LEAD',
    });

    return this.transactionalEventPublisher.execute<InitiateWidgetContactOutput>(
      async (tx) => {
        const events: IntegrationEvent[] = [];

        let conversation = await (
          tx as Prisma.TransactionClient
        ).conversation.findFirst({
          where: {
            tenantId: input.tenantId,
            contactId,
            channel: 'WEB_CHAT',
            status: { not: 'ARCHIVED' },
          },
          orderBy: { startedAt: 'desc' },
        });

        if (!conversation) {
          conversation = await (
            tx as Prisma.TransactionClient
          ).conversation.create({
            data: {
              tenantId: input.tenantId,
              contactId,
              channel: 'WEB_CHAT',
              status: 'ACTIVE',
              lastMessageAt: new Date(),
              lastMessageDirection: 'INBOUND',
              lastInboundAt: new Date(),
            },
          });

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

          // Synthetic init message triggers proactive AI welcome.
          // Keep minimal — instructions live in system prompt (NicheWelcomeMenuService).
          // DO NOT add menu-building instructions here: they persist in conversation history
          // on every turn and override system prompt guardrails, causing hallucination.
          const initText =
            '[WIDGET_INIT] Novo visitante no site. Apresente-se brevemente e exiba o menu de boas-vindas conforme as instruções do sistema. Não invente produtos, serviços ou preços — use apenas o contexto fornecido.';
          const initMessage = await (
            tx as Prisma.TransactionClient
          ).message.create({
            data: {
              conversationId: conversation.id,
              direction: 'INBOUND',
              contentType: 'TEXT',
              content: { text: initText },
              sentBy: 'SYSTEM',
              deliveryStatus: 'DELIVERED',
            },
          });

          events.push(
            new MessageReceivedIntegrationEvent(
              {
                conversationId: conversation.id,
                tenantId: input.tenantId,
                contactId,
                branchId: null,
                messageId: initMessage.id,
                content: { type: 'TEXT', text: initText },
                channel: 'WEB_CHAT',
                moduleId: 'widget',
                ...(input.quickReplies?.length
                  ? { contextHints: input.quickReplies }
                  : {}),
              },
              `messaging:widget-init:${initMessage.id}`,
            ),
          );
        }

        return {
          result: { contactId, conversationId: conversation.id },
          events,
        };
      },
    );
  }
}
