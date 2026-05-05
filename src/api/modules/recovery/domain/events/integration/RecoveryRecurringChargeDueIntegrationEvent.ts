import { IntegrationEvent } from '@shared/application/ports/IntegrationEvent';

export interface RecoveryRecurringChargeDuePayload extends Record<string, unknown> {
  tenantId: string;
  recurrenceId: string;
  caseId: string;
  scheduledFor: string;
}

export class RecoveryRecurringChargeDueIntegrationEvent extends IntegrationEvent {
  readonly queue = 'recovery.recurring-charge.due';
  readonly sourceModule = 'recovery';

  get eventName(): string {
    return 'recovery.recurring-charge.due.v1';
  }

  get aggregateId(): string | undefined {
    return this.payload.recurrenceId;
  }

  constructor(
    public readonly payload: RecoveryRecurringChargeDuePayload,
    eventId?: string,
  ) {
    super(eventId);
  }
}
