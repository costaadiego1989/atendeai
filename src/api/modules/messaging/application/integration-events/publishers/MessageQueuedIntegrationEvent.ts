import { IntegrationEvent } from '@shared/infrastructure/event-bus';

export type MessageQueuedIntegrationEventPayload = {
  tenantId: string;
  conversationId: string;
  contactId: string;
  messageId: string;
  channel: string;
  queuedBy: string;
  content: {
    type: string;
    text?: string;
    url?: string;
  };
};

export class MessageQueuedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'messaging.message-queued';
  readonly sourceModule = 'messaging';

  get eventName(): string {
    return 'messaging.message.queued.v1';
  }

  get aggregateId(): string | undefined {
    return this.payload.messageId;
  }

  constructor(
    public readonly payload: MessageQueuedIntegrationEventPayload,
    eventId?: string,
  ) {
    super(eventId);
  }
}
