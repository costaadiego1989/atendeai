import { IntegrationEvent } from '@shared/infrastructure/event-bus';

export type ConversationPendingHumanIntegrationEventPayload = {
  tenantId: string;
  conversationId: string;
  contactId: string;
  channel: string;
};

export class ConversationPendingHumanIntegrationEvent extends IntegrationEvent {
  readonly queue = 'messaging.conversation-pending-human';
  readonly sourceModule = 'messaging';

  get eventName(): string {
    return 'messaging.conversation.pending-human.v1';
  }

  get aggregateId(): string | undefined {
    return this.payload.conversationId;
  }

  constructor(
    public readonly payload: ConversationPendingHumanIntegrationEventPayload,
    eventId?: string,
  ) {
    super(eventId);
  }
}
