import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, IEventBus } from '@shared/infrastructure/event-bus';
import {
  IMessagingRealtimePublisher,
  MESSAGING_REALTIME_PUBLISHER,
} from '../ports/IMessagingRealtimePublisher';
import { MessageReceivedIntegrationEvent } from '../integration-events/publishers/MessageReceivedIntegrationEvent';
import {
  MessageFailedIntegrationEvent,
  MessageQueuedIntegrationEvent,
  MessageSentIntegrationEvent,
} from '../integration-events/publishers/MessageSentIntegrationEvent';
import { ConversationStatusChangedIntegrationEvent } from '../integration-events/publishers/ConversationStatusChangedIntegrationEvent';
import { ConversationCreatedIntegrationEvent } from '../integration-events/publishers/ConversationCreatedIntegrationEvent';

@Injectable()
export class MessagingRealtimeEventsHandler implements OnModuleInit {
  private readonly logger = new Logger(MessagingRealtimeEventsHandler.name);

  constructor(
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    @Inject(MESSAGING_REALTIME_PUBLISHER)
    private readonly realtimePublisher: IMessagingRealtimePublisher,
  ) {}

  onModuleInit() {
    this.eventBus.subscribe(
      'messaging.message-received',
      async (event) => {
        await this.handleMessageReceived(
          event as MessageReceivedIntegrationEvent,
        );
      },
      { consumerName: 'messaging-realtime-message-received' },
    );

    this.eventBus.subscribe(
      'messaging.message-queued',
      async (event) => {
        await this.handleMessageQueued(event as MessageQueuedIntegrationEvent);
      },
      { consumerName: 'messaging-realtime-message-queued' },
    );

    this.eventBus.subscribe(
      'messaging.message-sent',
      async (event) => {
        await this.handleMessageSent(event as MessageSentIntegrationEvent);
      },
      { consumerName: 'messaging-realtime-message-sent' },
    );

    this.eventBus.subscribe(
      'messaging.message-failed',
      async (event) => {
        await this.handleMessageFailed(event as MessageFailedIntegrationEvent);
      },
      { consumerName: 'messaging-realtime-message-failed' },
    );

    this.eventBus.subscribe(
      'messaging.conversation-status-changed',
      async (event) => {
        await this.handleConversationStatusChanged(
          event as ConversationStatusChangedIntegrationEvent,
        );
      },
      { consumerName: 'messaging-realtime-conversation-status-changed' },
    );

    this.eventBus.subscribe(
      'messaging.conversation-created',
      async (event) => {
        await this.handleConversationCreated(
          event as ConversationCreatedIntegrationEvent,
        );
      },
      { consumerName: 'messaging-realtime-conversation-created' },
    );
  }

  private async handleMessageReceived(
    event: MessageReceivedIntegrationEvent,
  ): Promise<void> {
    const payload = event.payload;

    this.logger.debug(
      `Publishing realtime inbound message [${payload.messageId}] for conversation [${payload.conversationId}]`,
    );

    await this.realtimePublisher.publish({
      type: 'message.received',
      tenantId: payload.tenantId,
      conversationId: payload.conversationId,
      messageId: payload.messageId,
      channel: payload.channel,
      at: new Date().toISOString(),
    });
  }

  private async handleMessageQueued(
    event: MessageQueuedIntegrationEvent,
  ): Promise<void> {
    const payload = event.payload;

    await this.realtimePublisher.publish({
      type: 'message.queued',
      tenantId: payload.tenantId,
      conversationId: payload.conversationId,
      messageId: payload.messageId,
      channel: payload.channel,
      at: new Date().toISOString(),
    });
  }

  private async handleMessageSent(
    event: MessageSentIntegrationEvent,
  ): Promise<void> {
    const payload = event.payload;

    await this.realtimePublisher.publish({
      type: 'message.sent',
      tenantId: payload.tenantId,
      conversationId: payload.conversationId,
      messageId: payload.messageId,
      channel: payload.channel,
      at: new Date().toISOString(),
    });
  }

  private async handleMessageFailed(
    event: MessageFailedIntegrationEvent,
  ): Promise<void> {
    const payload = event.payload;

    await this.realtimePublisher.publish({
      type: 'message.failed',
      tenantId: payload.tenantId,
      conversationId: payload.conversationId,
      messageId: payload.messageId,
      channel: payload.channel,
      at: new Date().toISOString(),
    });
  }

  private async handleConversationCreated(
    event: ConversationCreatedIntegrationEvent,
  ): Promise<void> {
    const payload = event.payload;

    await this.realtimePublisher.publish({
      type: 'conversation.created',
      tenantId: payload.tenantId,
      conversationId: payload.conversationId,
      contactId: payload.contactId,
      channel: payload.channel,
      at: new Date().toISOString(),
    });
  }

  private async handleConversationStatusChanged(
    event: ConversationStatusChangedIntegrationEvent,
  ): Promise<void> {
    const payload = event.payload;

    await this.realtimePublisher.publish({
      type: 'conversation.status.changed',
      tenantId: payload.tenantId,
      conversationId: payload.conversationId,
      channel: payload.channel,
      status: payload.status,
      at: new Date().toISOString(),
    });
  }
}
