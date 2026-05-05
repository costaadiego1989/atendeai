import { IntegrationEvent } from '@shared/application/ports/IntegrationEvent';

export class ProfessionalSlotPaymentConfirmedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'scheduling.professional_slot.payment_confirmed';
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
      meetingUrl?: string;
    },
  ) {
    super();
  }
}

export class ProfessionalSlotPaymentAttentionRequiredIntegrationEvent extends IntegrationEvent {
  readonly queue = 'scheduling.professional_slot.payment_attention_required';
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
      reason: 'OVERDUE' | 'REFUNDED';
      branchId: string | null;
    },
  ) {
    super();
  }
}
