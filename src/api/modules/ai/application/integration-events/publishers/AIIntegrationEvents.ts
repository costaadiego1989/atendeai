import { IntegrationEvent } from '@shared/infrastructure/event-bus';

export interface AIResponseGeneratedPayload {
  [key: string]: unknown;
  conversationId: string;
  tenantId: string;
  contactId: string;
  aiSessionId: string;
  response: { type: string; text: string };
  intent: string;
  sentiment: string;
  confidence: number;
  tokensUsed: number;
}

export interface AIEscalationRequestedPayload {
  [key: string]: unknown;
  conversationId: string;
  tenantId: string;
  contactId: string;
  reason: string;
  confidence: number;
  lastMessage: string;
  escalationMessage: string;
}

export interface LeadScoredPayload {
  [key: string]: unknown;
  conversationId: string;
  tenantId: string;
  contactId: string;
  score: number;
  isHot: boolean;
  intent: string;
  sentiment: string;
}

export interface AISafetyBlockedPayload {
  [key: string]: unknown;
  conversationId: string;
  tenantId: string;
  contactId: string;
  matchedPattern?: string;
  reason: string;
}

export interface AIQuotaDeniedPayload {
  [key: string]: unknown;
  conversationId: string;
  tenantId: string;
  contactId: string;
  usageType: string;
  status: string;
  used: number;
  quota: number;
}

export interface AIResponseFailedPayload {
  [key: string]: unknown;
  conversationId: string;
  tenantId: string;
  contactId: string;
  reason: string;
  provider: string;
  fallbackMessage: string;
}

export class AIResponseGeneratedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'ai.response-generated';
  readonly sourceModule = 'ai';
  readonly payload: AIResponseGeneratedPayload;
  get eventName(): string {
    return 'ai.response.generated.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.aiSessionId as string | undefined;
  }

  constructor(data: AIResponseGeneratedPayload) {
    super();
    this.payload = data;
  }
}

export class AIEscalationRequestedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'ai.escalation-requested';
  readonly sourceModule = 'ai';
  readonly payload: AIEscalationRequestedPayload;
  get eventName(): string {
    return 'ai.escalation.requested.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.conversationId as string | undefined;
  }

  constructor(data: AIEscalationRequestedPayload) {
    super();
    this.payload = data;
  }
}

export class LeadScoredIntegrationEvent extends IntegrationEvent {
  readonly queue = 'ai.lead-scored';
  readonly sourceModule = 'ai';
  readonly payload: LeadScoredPayload;
  get eventName(): string {
    return 'ai.lead.scored.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.conversationId as string | undefined;
  }

  constructor(data: LeadScoredPayload) {
    super();
    this.payload = data;
  }
}

export class AISafetyBlockedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'ai.safety-blocked';
  readonly sourceModule = 'ai';
  readonly payload: AISafetyBlockedPayload;
  get eventName(): string {
    return 'ai.safety.blocked.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.conversationId as string | undefined;
  }

  constructor(data: AISafetyBlockedPayload) {
    super();
    this.payload = data;
  }
}

export class AIQuotaDeniedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'ai.quota-denied';
  readonly sourceModule = 'ai';
  readonly payload: AIQuotaDeniedPayload;
  get eventName(): string {
    return 'ai.quota.denied.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.conversationId as string | undefined;
  }

  constructor(data: AIQuotaDeniedPayload) {
    super();
    this.payload = data;
  }
}

export class AIResponseFailedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'ai.response-failed';
  readonly sourceModule = 'ai';
  readonly payload: AIResponseFailedPayload;
  get eventName(): string {
    return 'ai.response.failed.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.conversationId as string | undefined;
  }

  constructor(data: AIResponseFailedPayload) {
    super();
    this.payload = data;
  }
}
