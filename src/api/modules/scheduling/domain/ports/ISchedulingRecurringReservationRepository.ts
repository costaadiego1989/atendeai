export type SchedulingRecurrencePeriod = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
export type SchedulingRecurringReservationStatus =
  | 'ACTIVE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED';
export type SchedulingRecurringReservationRunStatus =
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'SKIPPED';

export interface SchedulingRecurringReservationRecord {
  id: string;
  tenantId: string;
  branchId?: string | null;
  professionalId: string;
  contactId?: string | null;
  categoryId?: string | null;
  conversationId?: string | null;
  period: SchedulingRecurrencePeriod;
  interval: number;
  maxOccurrences: number;
  occurrencesCreated: number;
  startsAt: string;
  endsAt: string;
  firstDate: string;
  endDate?: string | null;
  nextDate?: string | null;
  nextRunAt?: Date | null;
  isFree: boolean;
  isOnline: boolean;
  paymentTimeoutHours?: number | null;
  notes?: string | null;
  status: SchedulingRecurringReservationStatus;
  lastError?: string | null;
  leaseUntil?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date | null;
  cancelledAt?: Date | null;
}

export interface SchedulingRecurringReservationRunRecord {
  id: string;
  recurrenceId: string;
  tenantId: string;
  occurrenceNumber: number;
  targetDate: string;
  status: SchedulingRecurringReservationRunStatus;
  slotId?: string | null;
  errorMessage?: string | null;
  createdAt: Date;
  completedAt?: Date | null;
}

export interface CreateSchedulingRecurringReservationInput {
  tenantId: string;
  branchId?: string | null;
  professionalId: string;
  contactId?: string | null;
  categoryId?: string | null;
  conversationId?: string | null;
  period: SchedulingRecurrencePeriod;
  interval?: number;
  maxOccurrences: number;
  occurrencesCreated: number;
  startsAt: string;
  endsAt: string;
  firstDate: string;
  endDate?: string | null;
  nextDate?: string | null;
  nextRunAt?: Date | null;
  isFree: boolean;
  isOnline: boolean;
  paymentTimeoutHours?: number | null;
  notes?: string | null;
}

export interface ISchedulingRecurringReservationRepository {
  create(
    input: CreateSchedulingRecurringReservationInput,
  ): Promise<SchedulingRecurringReservationRecord>;
  findById(
    tenantId: string,
    recurrenceId: string,
  ): Promise<SchedulingRecurringReservationRecord | null>;
  list(input: {
    tenantId: string;
    professionalId?: string | null;
    status?: SchedulingRecurringReservationStatus | null;
  }): Promise<SchedulingRecurringReservationRecord[]>;
  claimDue(now: Date, limit: number): Promise<SchedulingRecurringReservationRecord[]>;
  releaseLease(input: {
    tenantId: string;
    recurrenceId: string;
    errorMessage?: string | null;
  }): Promise<void>;
  startRun(input: {
    recurrenceId: string;
    tenantId: string;
    occurrenceNumber: number;
    targetDate: string;
  }): Promise<SchedulingRecurringReservationRunRecord | null>;
  markRunSucceeded(input: { runId: string; slotId: string }): Promise<void>;
  markRunFailed(input: { runId: string; errorMessage: string }): Promise<void>;
  markRunSkipped(input: { runId: string; reason: string }): Promise<void>;
  advanceAfterSuccess(input: {
    tenantId: string;
    recurrenceId: string;
    occurrencesCreated: number;
    nextDate?: string | null;
    nextRunAt?: Date | null;
  }): Promise<SchedulingRecurringReservationRecord>;
  cancel(input: {
    tenantId: string;
    recurrenceId: string;
    reason?: string;
  }): Promise<SchedulingRecurringReservationRecord>;
  delete(input: {
    tenantId: string;
    recurrenceId: string;
  }): Promise<void>;
}

export const SCHEDULING_RECURRING_RESERVATION_REPOSITORY = Symbol(
  'SCHEDULING_RECURRING_RESERVATION_REPOSITORY',
);
