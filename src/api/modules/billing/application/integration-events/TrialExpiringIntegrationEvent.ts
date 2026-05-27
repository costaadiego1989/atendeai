import { IntegrationEvent } from '@shared/application/ports/IntegrationEvent';

export interface TrialExpiringEventPayload {
  tenantId: string;
  subscriptionId: string;
  invoiceUrl: string;
}

export class TrialExpiringIntegrationEvent extends IntegrationEvent {
  readonly queue = 'billing.trial-expiring';
  readonly sourceModule = 'billing';
  readonly payload: Record<string, unknown>;

  constructor(public readonly eventData: TrialExpiringEventPayload) {
    super();
    this.payload = { ...eventData };
  }
}
