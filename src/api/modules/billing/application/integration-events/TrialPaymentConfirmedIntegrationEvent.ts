import { IntegrationEvent } from '@shared/application/ports/IntegrationEvent';

export class TrialPaymentConfirmedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'billing.trial-confirmed';
  readonly sourceModule = 'billing';
  readonly payload: Record<string, unknown>;

  get eventName(): string {
    return 'billing.trial.confirmed.v1';
  }

  get aggregateId(): string | undefined {
    return this.payload.ownerEmail as string;
  }

  constructor(data: {
    plan: string;
    companyName: string;
    ownerName: string;
    ownerEmail: string;
    ownerPhone: string;
  }) {
    super();
    this.payload = data;
  }
}
