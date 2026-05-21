import { IntegrationEvent } from '@shared/infrastructure/event-bus';

export class MessageReceivedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'messaging.message-received';
  readonly sourceModule = 'messaging';
  get eventName(): string {
    return 'messaging.message.received.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.messageId;
  }

  constructor(
    public readonly payload: {
      conversationId: string;
      tenantId: string;
      contactId: string;
      branchId?: string | null;
      messageId: string;
      content: {
        type: string;
        text?: string;
        url?: string;
        mimeType?: string;
        fileName?: string;
      };
      channel: 'WHATSAPP' | 'INSTAGRAM' | 'WEB_CHAT';
      contextHints?: string[];
    },
    eventId?: string,
  ) {
    super(eventId);
  }
}
