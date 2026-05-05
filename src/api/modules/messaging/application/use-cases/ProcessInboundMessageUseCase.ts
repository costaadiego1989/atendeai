import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IntegrationEvent } from '@shared/infrastructure/event-bus';
import {
  IConversationRepository,
  CONVERSATION_REPOSITORY,
} from '../../domain/repositories/IConversationRepository';
import {
  IContactFacade,
  CONTACT_FACADE,
} from '../../../contact/application/facades/ContactFacade';
import { Conversation } from '../../domain/entities/Conversation';
import { Message } from '../../domain/entities/Message';
import { MessageContent } from '../../domain/value-objects/MessageContent';
import { TenantId } from '../../../../shared/domain/TenantId';
import { UniqueEntityID } from '../../../../shared/domain/UniqueEntityID';
import { MessageReceivedIntegrationEvent } from '../integration-events/publishers/MessageReceivedIntegrationEvent';
import { ConversationCreatedIntegrationEvent } from '../integration-events/publishers/ConversationCreatedIntegrationEvent';
import {
  IProcessInboundMessageUseCase,
  ProcessInboundMessageInput,
} from './interfaces/IProcessInboundMessageUseCase';
import { PrismaTransactionalEventPublisher } from '@shared/infrastructure/event-bus/PrismaTransactionalEventPublisher';
import { ConversationIntelligenceService } from '../services/ConversationIntelligenceService';

@Injectable()
export class ProcessInboundMessageUseCase implements IProcessInboundMessageUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: IConversationRepository,
    @Inject(CONTACT_FACADE)
    private readonly contactFacade: IContactFacade,
    private readonly transactionalEventPublisher: PrismaTransactionalEventPublisher,
    private readonly conversationIntelligenceService: ConversationIntelligenceService,
  ) { }

  async execute(input: ProcessInboundMessageInput): Promise<void> {
    await this.transactionalEventPublisher.execute(async (tx) => {
      const events = await this.persistInboundMessage(input, { tx });
      return {
        result: undefined,
        events,
      };
    });
  }

  async persistInboundMessage(
    input: ProcessInboundMessageInput,
    options?: { tx?: Prisma.TransactionClient; skipDuplicateCheck?: boolean },
  ): Promise<IntegrationEvent[]> {
    if (!options?.skipDuplicateCheck) {
      const existingConversation =
        await this.conversationRepository.findByExternalMessageId(
          input.externalMessageId,
        );
      if (existingConversation) {
        return [];
      }
    }

    const tenantId = TenantId.create(input.tenantId);

    const { contactId } = await this.contactFacade.identifyContact(
      tenantId.toString(),
      input.fromPhone,
      input.fromPhone,
    );
    const contact = await this.contactFacade.getContactById(
      tenantId.toString(),
      contactId,
    );
    const branchId = input.branchId ?? contact?.branchId ?? null;

    let conversation = await this.conversationRepository.findLatestByContact(
      tenantId.toString(),
      contactId,
    );

    let shouldReleaseAssignment = false;

    let isNewConversation = false;

    if (!conversation) {
      conversation = Conversation.create({
        tenantId,
        contactId: new UniqueEntityID(contactId),
        branchId,
        channel: input.channel,
      });
      isNewConversation = true;
    } else if (conversation.status === 'ARCHIVED') {
      conversation.activate();
      shouldReleaseAssignment = true;
    }

    const contentType = this.normalizeContentType(input.contentType);
    const content = MessageContent.create({
      type: contentType,
      ...(input.content.text ? { text: input.content.text } : {}),
      ...(input.content.url ? { url: input.content.url } : {}),
      ...(contentType !== 'TEXT'
        ? {
          metadata: {
            source: input.channel,
            originalType: input.contentType,
            ...(input.content.mimeType ? { mimeType: input.content.mimeType } : {}),
            ...(input.content.fileName ? { fileName: input.content.fileName } : {}),
          },
        }
        : {}),
    });
    const signalText = this.toSignalText(content.toPersistence());

    const message = Message.create({
      conversationId: conversation.id,
      direction: 'INBOUND',
      contentType,
      content,
      sentBy: 'CONTACT',
      externalId: input.externalMessageId,
    });

    conversation.addMessage(message);

    await this.conversationRepository.save(conversation, { tx: options?.tx });
    await this.conversationIntelligenceService.captureMessageSignal({
      tenantId: tenantId.toString(),
      conversationId: conversation.id.toString(),
      direction: 'INBOUND',
      sentBy: 'CONTACT',
      text: signalText,
      options: { tx: options?.tx },
    });
    if (shouldReleaseAssignment) {
      await this.conversationRepository.setAssignedUser(
        tenantId.toString(),
        conversation.id.toString(),
        null,
      );
    }

    const events: IntegrationEvent[] = [];
    if (isNewConversation) {
      events.push(
        new ConversationCreatedIntegrationEvent({
          tenantId: tenantId.toString(),
          conversationId: conversation.id.toString(),
          contactId,
          channel: input.channel,
        }, `messaging:conv-created:${conversation.id.toString()}`)
      );
    }

    events.push(
        new MessageReceivedIntegrationEvent({
        conversationId: conversation.id.toString(),
        tenantId: tenantId.toString(),
        contactId: contactId,
        branchId,
        messageId: message.id.toString(),
        content: {
          type: contentType,
          ...(input.content.text ? { text: input.content.text } : {}),
          ...(input.content.url ? { url: input.content.url } : {}),
          ...(input.content.mimeType ? { mimeType: input.content.mimeType } : {}),
          ...(input.content.fileName ? { fileName: input.content.fileName } : {}),
        },
        channel: input.channel,
      }, `messaging:inbound:${input.externalMessageId}`)
    );

    return events;
  }

  private normalizeContentType(contentType: ProcessInboundMessageInput['contentType']) {
    return contentType.toUpperCase() as 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT';
  }

  private toSignalText(content: { type: string; text?: string; url?: string }) {
    if (content.type === 'TEXT') {
      return content.text || '';
    }

    const labels: Record<string, string> = {
      IMAGE: 'imagem',
      AUDIO: 'audio',
      VIDEO: 'video',
      DOCUMENT: 'documento',
    };
    const label = labels[content.type] || 'arquivo';
    const parts = [`Cliente enviou ${label} pelo WhatsApp.`];

    if (content.text) {
      parts.push(`Mensagem: ${content.text}`);
    }
    if (content.url) {
      parts.push(`Arquivo: ${content.url}`);
    }

    return parts.join('\n');
  }
}
