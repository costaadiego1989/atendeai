import { IntegrationEvent } from '@shared/application/ports/IntegrationEvent';

export interface SchedulingRecurringReservationDuePayload
  extends Record<string, unknown> {
  tenantId: string;
  recurrenceId: string;
  professionalId: string;
  targetDate: string;
}

export class SchedulingRecurringReservationDueIntegrationEvent extends IntegrationEvent {
  readonly queue = 'scheduling.recurring-reservation.due';
  readonly sourceModule = 'scheduling';

  get eventName(): string {
    return 'scheduling.recurring-reservation.due.v1';
  }

  get aggregateId(): string | undefined {
    return this.payload.recurrenceId;
  }

  constructor(
    public readonly payload: SchedulingRecurringReservationDuePayload,
    eventId?: string,
  ) {
    super(eventId);
  }
}
