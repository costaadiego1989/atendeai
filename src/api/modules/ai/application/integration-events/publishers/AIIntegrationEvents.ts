import { IntegrationEvent } from '@shared/infrastructure/event-bus';

export class AIResponseGeneratedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'ai.response-generated';
  readonly sourceModule = 'ai';
  readonly payload: Record<string, unknown>;
  get eventName(): string {
    return 'ai.response.generated.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.aiSessionId as string;
  }

  constructor(data: {
    conversationId: string;
    tenantId: string;
    contactId: string;
    aiSessionId: string;
    response: { type: string; text: string };
    intent: string;
    sentiment: string;
    confidence: number;
    tokensUsed: number;
  }) {
    super();
    this.payload = data;
  }
}

export class AIEscalationRequestedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'ai.escalation-requested';
  readonly sourceModule = 'ai';
  readonly payload: Record<string, unknown>;
  get eventName(): string {
    return 'ai.escalation.requested.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.conversationId as string;
  }

  constructor(data: {
    conversationId: string;
    tenantId: string;
    contactId: string;
    reason: string;
    confidence: number;
    lastMessage: string;
    escalationMessage: string;
  }) {
    super();
    this.payload = data;
  }
}

export class LeadScoredIntegrationEvent extends IntegrationEvent {
  readonly queue = 'ai.lead-scored';
  readonly sourceModule = 'ai';
  readonly payload: Record<string, unknown>;
  get eventName(): string {
    return 'ai.lead.scored.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.conversationId as string;
  }

  constructor(data: {
    conversationId: string;
    tenantId: string;
    contactId: string;
    score: number;
    isHot: boolean;
    intent: string;
    sentiment: string;
  }) {
    super();
    this.payload = data;
  }
}

export class AISafetyBlockedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'ai.safety-blocked';
  readonly sourceModule = 'ai';
  readonly payload: Record<string, unknown>;
  get eventName(): string {
    return 'ai.safety.blocked.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.conversationId as string;
  }

  constructor(data: {
    conversationId: string;
    tenantId: string;
    contactId: string;
    matchedPattern?: string;
    reason: string;
  }) {
    super();
    this.payload = data;
  }
}

export class AIQuotaDeniedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'ai.quota-denied';
  readonly sourceModule = 'ai';
  readonly payload: Record<string, unknown>;
  get eventName(): string {
    return 'ai.quota.denied.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.conversationId as string;
  }

  constructor(data: {
    conversationId: string;
    tenantId: string;
    contactId: string;
    usageType: string;
    status: string;
    used: number;
    quota: number;
  }) {
    super();
    this.payload = data;
  }
}

export class AIResponseFailedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'ai.response-failed';
  readonly sourceModule = 'ai';
  readonly payload: Record<string, unknown>;
  get eventName(): string {
    return 'ai.response.failed.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.conversationId as string;
  }

  constructor(data: {
    conversationId: string;
    tenantId: string;
    contactId: string;
    reason: string;
    provider: string;
    fallbackMessage: string;
  }) {
    super();
    this.payload = data;
  }
}
