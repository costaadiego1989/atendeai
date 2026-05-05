import { IntegrationEvent } from '@shared/application/ports/IntegrationEvent';

export class SalesPaymentChargeCreatedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'sales.payment_charge.created';
  readonly sourceModule = 'sales';

  constructor(
    public readonly payload: {
      tenantId: string;
      contactId: string;
      contactName: string;
      invoiceUrl: string;
      value: number;
      branchId: string | null;
      conversationId?: string | null;
    },
  ) {
    super();
  }
}
