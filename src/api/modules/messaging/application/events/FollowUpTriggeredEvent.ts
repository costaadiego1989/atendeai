import { IntegrationEvent } from '../../../../shared/infrastructure/event-bus/IntegrationEvent';

export interface FollowUpTriggeredPayload extends Record<string, unknown> {
  conversationId: string;
  tenantId: string;
  contactId: string;
  interval: string;
  intelligence?: {
    summary?: string | null;
    sentiment?: string | null;
    tags?: string[];
    interests?: string[];
    nextStep?: string | null;
    lossReason?: string | null;
  };
}

export class FollowUpTriggeredEvent extends IntegrationEvent {
  constructor(public readonly payload: FollowUpTriggeredPayload) {
    super();
  }

  get queue(): string {
    return 'messaging.follow-up-triggered';
  }
  get sourceModule(): string {
    return 'messaging';
  }
}
