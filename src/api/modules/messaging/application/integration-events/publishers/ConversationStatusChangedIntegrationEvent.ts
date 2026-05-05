import { IntegrationEvent } from '@shared/infrastructure/event-bus';

export class ConversationStatusChangedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'messaging.conversation-status-changed';
  readonly sourceModule = 'messaging';

  get eventName(): string {
    return 'messaging.conversation.status-changed.v1';
  }

  get aggregateId(): string | undefined {
    return this.payload.conversationId;
  }

  constructor(
    public readonly payload: {
      tenantId: string;
      conversationId: string;
      contactId: string;
      channel: string;
      status: string;
    },
    eventId?: string,
  ) {
    super(eventId);
  }
}
