import { IntegrationEvent } from '@shared/infrastructure/event-bus';

export type MessageDeliveryFailedPayload = {
  tenantId: string;
  conversationId: string;
  contactId: string;
  messageId: string;
  channel: string;
  reason: string;
  attempts: number;
  lastError: string;
  content: {
    type: string;
    text?: string;
    url?: string;
  };
};

export class MessageDeliveryFailedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'messaging.message-delivery-failed';
  readonly sourceModule = 'messaging';

  get eventName(): string {
    return 'messaging.message.delivery_failed.v1';
  }

  get aggregateId(): string | undefined {
    return this.payload.messageId;
  }

  constructor(
    public readonly payload: MessageDeliveryFailedPayload,
    eventId?: string,
  ) {
    super(eventId);
  }
}
