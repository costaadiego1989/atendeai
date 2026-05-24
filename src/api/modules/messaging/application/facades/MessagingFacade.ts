import { Inject, Injectable } from '@nestjs/common';
import {
  CONVERSATION_REPOSITORY,
  IConversationRepository,
} from '../../domain/repositories/IConversationRepository';
import {
  CONTACT_FACADE,
  IContactFacade,
} from '@modules/contact/application/facades/ContactFacade';
import { Conversation } from '../../domain/entities/Conversation';
import { Message } from '../../domain/entities/Message';
import { MessageContent } from '../../domain/value-objects/MessageContent';
import { MESSAGE_QUEUE, IMessageQueue } from '../../domain/ports/IMessageQueue';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { MessageQueuedIntegrationEvent } from '../integration-events/publishers/MessageSentIntegrationEvent';
import { TenantId } from '@shared/domain/TenantId';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { TemplateComponent } from '../ports/IWhatsAppTemplateSender';

export type { TemplateComponent };

export interface QueueTemplateMessageParams {
  tenantId: string;
  contactId: string;
  phone: string;
  channel: 'WHATSAPP';
  templateName: string;
  languageCode: string;
  components: TemplateComponent[];
  renderedBody?: string;
}

export interface IMessagingFacade {
  queueSystemMessage(input: {
    tenantId: string;
    contactId: string;
    channel: 'WHATSAPP' | 'INSTAGRAM';
    text: string;
    branchId?: string | null;
    conversationId?: string | null;
  }): Promise<{ conversationId: string; messageId: string }>;

  queueTemplateMessage(
    input: QueueTemplateMessageParams,
  ): Promise<{ conversationId: string; messageId: string }>;
}

export const MESSAGING_FACADE = 'MESSAGING_FACADE';

@Injectable()
export class MessagingFacade implements IMessagingFacade {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: IConversationRepository,
    @Inject(CONTACT_FACADE)
    private readonly contactFacade: IContactFacade,
    @Inject(MESSAGE_QUEUE)
    private readonly messageQueue: IMessageQueue,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
  ) {}

  async queueSystemMessage(input: {
    tenantId: string;
    contactId: string;
    channel: 'WHATSAPP' | 'INSTAGRAM';
    text: string;
    branchId?: string | null;
    conversationId?: string | null;
  }): Promise<{ conversationId: string; messageId: string }> {
    let conversation = input.conversationId
      ? await this.conversationRepository.findById(input.conversationId)
      : await this.conversationRepository.findLatestByContact(
          input.tenantId,
          input.contactId,
        );

    if (
      conversation &&
      (conversation.tenantId.toString() !== input.tenantId ||
        conversation.contactId.toString() !== input.contactId)
    ) {
      conversation = null;
    }

    let shouldReleaseAssignment = false;
    const contact =
      input.branchId === undefined
        ? await this.contactFacade.getContactById(
            input.tenantId,
            input.contactId,
          )
        : null;
    const resolvedBranchId = input.branchId ?? contact?.branchId ?? null;

    if (!conversation) {
      conversation = Conversation.create({
        tenantId: TenantId.create(input.tenantId),
        contactId: new UniqueEntityID(input.contactId),
        branchId: resolvedBranchId,
        channel: input.channel,
      });
    } else if (conversation.status === 'ARCHIVED') {
      conversation.activate();
      shouldReleaseAssignment = true;
    }

    const message = Message.create({
      conversationId: conversation.id,
      direction: 'OUTBOUND',
      contentType: 'TEXT',
      content: MessageContent.createText(input.text),
      sentBy: 'SYSTEM',
    });

    conversation.addMessage(message);
    await this.conversationRepository.save(conversation);
    if (shouldReleaseAssignment) {
      await this.conversationRepository.setAssignedUser(
        input.tenantId,
        conversation.id.toString(),
        null,
      );
    }
    await this.messageQueue.addJob({
      messageId: message.id.toString(),
    });
    await this.eventBus.publish(
      new MessageQueuedIntegrationEvent({
        tenantId: input.tenantId,
        conversationId: conversation.id.toString(),
        contactId: input.contactId,
        messageId: message.id.toString(),
        channel: conversation.channel,
        queuedBy: 'SYSTEM',
        content: {
          type: 'TEXT',
          text: input.text,
        },
      }),
    );

    return {
      conversationId: conversation.id.toString(),
      messageId: message.id.toString(),
    };
  }

  async queueTemplateMessage(
    input: QueueTemplateMessageParams,
  ): Promise<{ conversationId: string; messageId: string }> {
    let conversation = await this.conversationRepository.findLatestByContact(
      input.tenantId,
      input.contactId,
    );

    if (
      conversation &&
      (conversation.tenantId.toString() !== input.tenantId ||
        conversation.contactId.toString() !== input.contactId)
    ) {
      conversation = null;
    }

    let shouldReleaseAssignment = false;

    if (!conversation) {
      conversation = Conversation.create({
        tenantId: TenantId.create(input.tenantId),
        contactId: new UniqueEntityID(input.contactId),
        branchId: null,
        channel: input.channel,
      });
    } else if (conversation.status === 'ARCHIVED') {
      conversation.activate();
      shouldReleaseAssignment = true;
    }

    const bodyText = input.renderedBody ?? input.templateName;
    const message = Message.create({
      conversationId: conversation.id,
      direction: 'OUTBOUND',
      contentType: 'TEMPLATE',
      content: MessageContent.createTemplate({
        renderedBody: bodyText,
        phone: input.phone,
        templateName: input.templateName,
        languageCode: input.languageCode,
        components: input.components as unknown as Record<string, unknown>[],
      }),
      sentBy: 'SYSTEM',
    });

    conversation.addMessage(message);
    await this.conversationRepository.save(conversation);

    if (shouldReleaseAssignment) {
      await this.conversationRepository.setAssignedUser(
        input.tenantId,
        conversation.id.toString(),
        null,
      );
    }

    await this.messageQueue.addJob({
      messageId: message.id.toString(),
    });

    await this.eventBus.publish(
      new MessageQueuedIntegrationEvent({
        tenantId: input.tenantId,
        conversationId: conversation.id.toString(),
        contactId: input.contactId,
        messageId: message.id.toString(),
        channel: conversation.channel,
        queuedBy: 'SYSTEM',
        content: {
          type: 'TEXT',
          text: bodyText,
        },
      }),
    );

    return {
      conversationId: conversation.id.toString(),
      messageId: message.id.toString(),
    };
  }
}
