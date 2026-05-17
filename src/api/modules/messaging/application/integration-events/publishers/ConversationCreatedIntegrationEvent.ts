import { IntegrationEvent } from '@shared/infrastructure/event-bus';

export type ConversationCreatedIntegrationEventPayload = {
  tenantId: string;
  conversationId: string;
  contactId: string;
  channel: string;
};

export class ConversationCreatedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'messaging.conversation-created';
  readonly sourceModule = 'messaging';

  get eventName(): string {
    return 'messaging.conversation.created.v1';
  }

  get aggregateId(): string | undefined {
    return this.payload.conversationId;
  }

  constructor(
    public readonly payload: ConversationCreatedIntegrationEventPayload,
    eventId?: string,
  ) {
    super(eventId);
  }
}
