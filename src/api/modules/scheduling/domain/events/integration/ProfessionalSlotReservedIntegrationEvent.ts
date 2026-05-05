import { IntegrationEvent } from '@shared/application/ports/IntegrationEvent';

export class ProfessionalSlotReservedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'scheduling.professional_slot.reserved';
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
      branchId: string | null;
      meetingUrl?: string;
    },
  ) {
    super();
  }
}
