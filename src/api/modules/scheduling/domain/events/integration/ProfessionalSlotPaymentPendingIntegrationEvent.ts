import { IntegrationEvent } from '../../../../../shared/application/ports/IntegrationEvent';

export class ProfessionalSlotPaymentPendingIntegrationEvent extends IntegrationEvent {
  readonly queue = 'scheduling.professional_slot.payment_pending';
  readonly sourceModule = 'scheduling';

  constructor(
    public readonly payload: {
      tenantId: string;
      contactId: string;
      professionalName: string;
      categoryName: string;
      date: string;
      startsAt: string;
      endsAt: string;
      paymentUrl: string;
      expiresAt: string;
      branchId: string | null;
    },
  ) {
    super();
  }
}
