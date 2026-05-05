import { IntegrationEvent } from '@shared/infrastructure/event-bus';

interface PaymentEventMetadata extends Record<string, unknown> {
  provider?: string;
  occurredAt?: Date;
  rawReference?: string;
}

export interface PaymentConfirmedPayload extends PaymentEventMetadata {
  tenantId: string;
  paymentId: string;
  amount: number;
  confirmedAt: Date;
}

export interface PaymentOverduePayload extends PaymentEventMetadata {
  tenantId: string;
  paymentId: string;
  overdueAt: Date;
  amount?: number;
}

export interface PaymentRefundedPayload extends PaymentEventMetadata {
  tenantId: string;
  paymentId: string;
  refundedAt: Date;
  amount?: number;
}

export interface TrialSubscriptionInitiatedPayload extends PaymentEventMetadata {
  tenantId: string;
  asaasCustomerId: string;
  asaasSubscriptionId: string;
  plan: string;
}

export interface TrialExpiredPayload extends PaymentEventMetadata {
  tenantId: string;
  subscriptionId: string;
}

export class PaymentConfirmedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'payment.confirmed';
  readonly sourceModule = 'payment';
  get eventName(): string {
    return 'payment.payment.confirmed.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.paymentId;
  }

  constructor(
    public readonly payload: PaymentConfirmedPayload,
    eventId?: string,
  ) {
    super(eventId);
  }
}

export class PaymentOverdueIntegrationEvent extends IntegrationEvent {
  readonly queue = 'payment.overdue';
  readonly sourceModule = 'payment';
  get eventName(): string {
    return 'payment.payment.overdue.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.paymentId;
  }

  constructor(
    public readonly payload: PaymentOverduePayload,
    eventId?: string,
  ) {
    super(eventId);
  }
}

export class PaymentRefundedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'payment.refunded';
  readonly sourceModule = 'payment';
  get eventName(): string {
    return 'payment.payment.refunded.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.paymentId;
  }

  constructor(
    public readonly payload: PaymentRefundedPayload,
    eventId?: string,
  ) {
    super(eventId);
  }
}

export class TrialSubscriptionInitiatedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'payment.trial-initiated';
  readonly sourceModule = 'payment';
  get eventName(): string {
    return 'payment.trial-subscription-initiated.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.tenantId;
  }

  constructor(
    public readonly payload: TrialSubscriptionInitiatedPayload,
    eventId?: string,
  ) {
    super(eventId);
  }
}

export class TrialExpiredIntegrationEvent extends IntegrationEvent {
  readonly queue = 'payment.trial-expired';
  readonly sourceModule = 'payment';
  get eventName(): string {
    return 'payment.trial-expired.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.tenantId;
  }

  constructor(
    public readonly payload: TrialExpiredPayload,
    eventId?: string,
  ) {
    super(eventId);
  }
}
