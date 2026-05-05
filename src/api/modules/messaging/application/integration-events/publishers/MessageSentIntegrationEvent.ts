import { IntegrationEvent } from '@shared/infrastructure/event-bus';

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
    public readonly payload: {
      tenantId: string;
      conversationId: string;
      contactId: string;
      messageId: string;
      channel: string;
      queuedBy: 'HUMAN' | 'AI' | 'SYSTEM';
      content: { type: string; text?: string; url?: string };
    },
    eventId?: string,
  ) {
    super(eventId);
  }
}

export class MessageSentIntegrationEvent extends IntegrationEvent {
  readonly queue = 'messaging.message-sent';
  readonly sourceModule = 'messaging';
  get eventName(): string {
    return 'messaging.message.sent.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.messageId;
  }

  constructor(
    public readonly payload: {
      tenantId: string;
      conversationId: string;
      contactId: string;
      messageId: string;
      channel: string;
      content: { type: string; text?: string; url?: string };
    },
    eventId?: string,
  ) {
    super(eventId);
  }
}

export class MessageFailedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'messaging.message-failed';
  readonly sourceModule = 'messaging';
  get eventName(): string {
    return 'messaging.message.failed.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.messageId;
  }

  constructor(
    public readonly payload: {
      tenantId: string;
      conversationId: string;
      contactId: string;
      messageId: string;
      channel: string;
      reason: string;
      content: { type: string; text?: string; url?: string };
    },
    eventId?: string,
  ) {
    super(eventId);
  }
}
