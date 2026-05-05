import { IntegrationEvent } from '@shared/application/ports/IntegrationEvent';

export class BillingSubscriptionProvisionedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'billing.subscription-provisioned';
  readonly sourceModule = 'billing';
  readonly payload: Record<string, unknown>;
  get eventName(): string {
    return 'billing.subscription.provisioned.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.tenantId as string;
  }

  constructor(data: {
    tenantId: string;
    plan: string;
    status: string;
    asaasCustomerId?: string;
    asaasSubscriptionId?: string;
  }) {
    super();
    this.payload = data;
  }
}

export class BillingSubscriptionActivatedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'billing.subscription-activated';
  readonly sourceModule = 'billing';
  readonly payload: Record<string, unknown>;
  get eventName(): string {
    return 'billing.subscription.activated.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.tenantId as string;
  }

  constructor(data: {
    tenantId: string;
    plan: string;
    billingCycleStart: string;
    billingCycleEnd: string;
  }) {
    super();
    this.payload = data;
  }
}

export class BillingSubscriptionOverdueIntegrationEvent extends IntegrationEvent {
  readonly queue = 'billing.subscription-overdue';
  readonly sourceModule = 'billing';
  readonly payload: Record<string, unknown>;
  get eventName(): string {
    return 'billing.subscription.overdue.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.tenantId as string;
  }

  constructor(data: {
    tenantId: string;
    plan: string;
    overdueReason: 'PAYMENT_OVERDUE' | 'PAYMENT_REFUNDED';
    status: string;
  }) {
    super();
    this.payload = data;
  }
}

export class BillingCycleRenewedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'billing.cycle-renewed';
  readonly sourceModule = 'billing';
  readonly payload: Record<string, unknown>;
  get eventName(): string {
    return 'billing.cycle.renewed.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.tenantId as string;
  }

  constructor(data: {
    tenantId: string;
    plan: string;
    billingCycleStart: string;
    billingCycleEnd: string;
    confirmedAt: string;
  }) {
    super();
    this.payload = data;
  }
}
export class BillingQuotaExceededIntegrationEvent extends IntegrationEvent {
  readonly queue = 'billing.quota-exceeded';
  readonly sourceModule = 'billing';
  readonly payload: Record<string, unknown>;
  get eventName(): string {
    return 'billing.quota.exceeded.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.tenantId as string;
  }

  constructor(data: {
    tenantId: string;
    type: string;
    used: number;
    quota: number;
  }) {
    super();
    this.payload = data;
  }
}

export class BillingQuotaWarningIntegrationEvent extends IntegrationEvent {
  readonly queue = 'billing.quota-warning';
  readonly sourceModule = 'billing';
  readonly payload: Record<string, unknown>;
  get eventName(): string {
    return 'billing.quota.warning.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.tenantId as string;
  }

  constructor(data: {
    tenantId: string;
    type: string;
    percentUsed: number;
    used: number;
    quota: number;
  }) {
    super();
    this.payload = data;
  }
}
