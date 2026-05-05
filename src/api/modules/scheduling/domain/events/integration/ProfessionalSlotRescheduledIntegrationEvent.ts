import { IntegrationEvent } from '@shared/application/ports/IntegrationEvent';

export class ProfessionalSlotRescheduledIntegrationEvent extends IntegrationEvent {
  readonly queue = 'scheduling.professional_slot.rescheduled';
  readonly sourceModule = 'scheduling';

  constructor(
    public readonly payload: {
      tenantId: string;
      contactId: string;
      contactName?: string;
      professionalName: string;
      categoryName: string;
      date: string;
      startsAt: string;
      endsAt: string;
      branchId: string | null;
      pendingPayment: boolean;
      paymentUrl?: string;
      paymentExpiresAt?: string;
      meetingUrl?: string;
    },
  ) {
    super();
  }
}
