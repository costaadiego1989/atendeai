import { Inject, Injectable } from '@nestjs/common';
import {
  CONVERSATION_REPOSITORY,
  IConversationRepository,
} from '../../domain/repositories/IConversationRepository';
import { MessagingChannel } from '../../domain/ports/IMessagingGateway';
import {
  IMessagingGatewayRegistry,
  MESSAGING_GATEWAY_REGISTRY,
} from '../../domain/ports/IMessagingGatewayRegistry';
import {
  TENANT_FACADE,
  ITenantFacade,
} from '../../../tenant/application/facades/ITenantFacade';
import {
  CONTACT_FACADE,
  IContactFacade,
} from '../../../contact/application/facades/ContactFacade';
import {
  EVENT_BUS,
  IEventBus,
} from '../../../../shared/application/ports/IEventBus';
import {
  MessageFailedIntegrationEvent,
  MessageSentIntegrationEvent,
} from '../integration-events/publishers/MessageSentIntegrationEvent';
import { MessageDeliveryFailedIntegrationEvent } from '../integration-events/publishers/MessageDeliveryFailedIntegrationEvent';
import { StructuredLogEmitter } from '@shared/infrastructure/observability/StructuredLogEmitter';
import { OutboundMessageRetryService } from '../services/OutboundMessageRetryService';

export interface ProcessOutboundMessageInput {
  messageId: string;
  /** Id do job BullMQ quando o envio vem da fila `outbound-messages`. */
  queueJobId?: string;
}

@Injectable()
export class ProcessOutboundMessageUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: IConversationRepository,
    @Inject(CONTACT_FACADE)
    private readonly contactFacade: IContactFacade,
    @Inject(MESSAGING_GATEWAY_REGISTRY)
    private readonly messagingGatewayRegistry: IMessagingGatewayRegistry,
    @Inject(TENANT_FACADE)
    private readonly tenantFacade: ITenantFacade,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    private readonly structuredLog: StructuredLogEmitter,
    private readonly retryService: OutboundMessageRetryService,
  ) {}

  async execute(input: ProcessOutboundMessageInput): Promise<void> {
    const conversation = await this.conversationRepository.findByMessageId(
      input.messageId,
    );
    if (!conversation) {
      this.structuredLog.emit({
        level: 'debug',
        event: 'messaging.outbound.skipped',
        message: 'Outbound: conversa nao encontrada para o messageId',
        attributes: {
          queue_job_id: input.queueJobId ?? '',
          message_id: input.messageId,
          reason: 'CONVERSATION_NOT_FOUND',
        },
      });
      return;
    }

    const message = conversation.messages.find(
      (m) => m.id.toString() === input.messageId,
    );
    if (!message || message.deliveryStatus !== 'PENDING') {
      this.structuredLog.emit({
        level: 'debug',
        event: 'messaging.outbound.skipped',
        message: 'Outbound: mensagem ausente ou nao pendente',
        tenantId: conversation.tenantId.toString(),
        attributes: {
          queue_job_id: input.queueJobId ?? '',
          message_id: input.messageId,
          conversation_id: conversation.id.toString(),
          reason: 'MESSAGE_NOT_PENDING',
        },
      });
      return;
    }

    const channel = conversation.channel as MessagingChannel;
    const contact = await this.contactFacade.getContactById(
      conversation.tenantId.toString(),
      conversation.contactId.toString(),
    );
    const config = await this.tenantFacade.getChannelConfig(
      conversation.tenantId.toString(),
      channel,
      conversation.branchId ?? contact?.branchId ?? null,
    );
    const gateway = config
      ? this.messagingGatewayRegistry.resolve(channel, config.provider)
      : null;

    if (!gateway || !config || config.status !== 'ACTIVE' || !contact?.phone) {
      const reason = this.resolveFailureReason({
        gateway,
        config,
        hasPhone: Boolean(contact?.phone),
      });
      this.structuredLog.emit({
        level: 'warn',
        event: 'messaging.outbound.precheck_failed',
        message: 'Outbound nao enviado: configuracao ou telefone invalido',
        tenantId: conversation.tenantId.toString(),
        attributes: {
          queue_job_id: input.queueJobId ?? '',
          message_id: input.messageId,
          conversation_id: conversation.id.toString(),
          channel,
          reason,
        },
      });
      message.updateStatus('FAILED');
      await this.conversationRepository.save(conversation);
      await this.publishFailedEvent(
        conversation,
        message.id.toString(),
        {
          type: message.contentType,
          text: message.content.text ?? '',
          ...(message.content.url ? { url: message.content.url } : {}),
        },
        reason,
      );
      return;
    }

    this.structuredLog.emit({
      level: 'info',
      event: 'messaging.outbound.dispatch_started',
      message: 'Enviando mensagem outbound pelo gateway',
      tenantId: conversation.tenantId.toString(),
      attributes: {
        queue_job_id: input.queueJobId ?? '',
        message_id: input.messageId,
        conversation_id: conversation.id.toString(),
        channel,
        messaging_provider: config.provider,
      },
    });

    const messageContent = {
      type: message.contentType.toLowerCase(),
      text: message.content.text,
      url: message.content.url,
    };

    const result = await this.retryService.sendWithRetry(
      gateway,
      config,
      contact.phone,
      messageContent,
      {
        messageId: input.messageId,
        tenantId: conversation.tenantId.toString(),
        conversationId: conversation.id.toString(),
      },
    );

    if (result.success) {
      message.updateStatus('SENT');
      await this.conversationRepository.save(conversation);
      await this.eventBus.publish(
        new MessageSentIntegrationEvent(
          {
            tenantId: conversation.tenantId.toString(),
            conversationId: conversation.id.toString(),
            contactId: conversation.contactId.toString(),
            messageId: message.id.toString(),
            channel: conversation.channel,
            content: {
              type: message.contentType,
              text: message.content.text ?? '',
              ...(message.content.url ? { url: message.content.url } : {}),
            },
          },
          `messaging:sent:${message.id.toString()}`,
        ),
      );
      this.structuredLog.emit({
        level: 'info',
        event: 'messaging.outbound.sent',
        message: 'Mensagem outbound enviada ao gateway',
        tenantId: conversation.tenantId.toString(),
        attributes: {
          queue_job_id: input.queueJobId ?? '',
          message_id: message.id.toString(),
          conversation_id: conversation.id.toString(),
          channel: conversation.channel,
          attempts: String(result.attempts),
        },
      });
    } else {
      message.updateStatus('FAILED');
      await this.conversationRepository.save(conversation);

      if (result.exhaustedRetries) {
        await this.eventBus.publish(
          new MessageDeliveryFailedIntegrationEvent(
            {
              tenantId: conversation.tenantId.toString(),
              conversationId: conversation.id.toString(),
              contactId: conversation.contactId.toString(),
              messageId: message.id.toString(),
              channel: conversation.channel,
              reason: 'RETRIES_EXHAUSTED',
              attempts: result.attempts,
              lastError: result.error ?? 'unknown',
              content: {
                type: message.contentType,
                text: message.content.text ?? '',
                ...(message.content.url ? { url: message.content.url } : {}),
              },
            },
            `messaging:delivery-failed:${message.id.toString()}`,
          ),
        );
      }

      this.structuredLog.emit({
        level: 'error',
        event: 'messaging.outbound.gateway_rejected',
        message: result.error ?? 'Gateway retornou falha',
        tenantId: conversation.tenantId.toString(),
        attributes: {
          queue_job_id: input.queueJobId ?? '',
          message_id: input.messageId,
          conversation_id: conversation.id.toString(),
          channel: conversation.channel,
          attempts: String(result.attempts),
          retries_exhausted: String(result.exhaustedRetries),
        },
      });
      throw new Error(
        `Failed to send message after ${result.attempts} attempt(s): ${result.error}`,
      );
    }
  }

  private resolveFailureReason(input: {
    gateway: ReturnType<IMessagingGatewayRegistry['resolve']> | null;
    config: Awaited<ReturnType<ITenantFacade['getChannelConfig']>> | null;
    hasPhone: boolean;
  }): string {
    if (!input.config) {
      return 'CHANNEL_NOT_CONFIGURED';
    }

    if (input.config.status !== 'ACTIVE') {
      return 'CHANNEL_INACTIVE';
    }

    if (!input.gateway) {
      return 'GATEWAY_NOT_AVAILABLE';
    }

    if (!input.hasPhone) {
      return 'CONTACT_PHONE_MISSING';
    }

    return 'UNKNOWN_FAILURE';
  }

  private async publishFailedEvent(
    conversation: Awaited<
      ReturnType<IConversationRepository['findByMessageId']>
    >,
    messageId: string,
    content: { type: string; text?: string; url?: string },
    reason: string,
  ): Promise<void> {
    if (!conversation) {
      return;
    }

    await this.eventBus.publish(
      new MessageFailedIntegrationEvent(
        {
          tenantId: conversation.tenantId.toString(),
          conversationId: conversation.id.toString(),
          contactId: conversation.contactId.toString(),
          messageId,
          channel: conversation.channel,
          reason,
          content,
        },
        `messaging:failed:${messageId}`,
      ),
    );
  }
}
