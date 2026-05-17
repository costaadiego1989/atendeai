export type RecoveryRecurringChargeStatus =
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED';

export type RecoveryRecurringChargeRunStatus =
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'SKIPPED';

export interface RecoveryRecurringChargeRecord {
  id: string;
  tenantId: string;
  branchId?: string | null;
  caseId: string;
  status: RecoveryRecurringChargeStatus;
  billingType: 'UNDEFINED' | 'BOLETO' | 'CREDIT_CARD' | 'PIX';
  intervalDays: number;
  maxOccurrences?: number | null;
  occurrencesSent: number;
  firstRunAt: Date;
  nextRunAt?: Date | null;
  lastRunAt?: Date | null;
  messageTemplate?: string | null;
  lastError?: string | null;
  leaseUntil?: Date | null;
  createdByUserId?: string | null;
  createdByUserEmail?: string | null;
  cancelledAt?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecoveryRecurringChargeRunRecord {
  id: string;
  recurrenceId: string;
  tenantId: string;
  caseId: string;
  occurrenceNumber: number;
  scheduledFor: Date;
  status: RecoveryRecurringChargeRunStatus;
  paymentLinkId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  errorMessage?: string | null;
  createdAt: Date;
  completedAt?: Date | null;
}

export interface CreateRecoveryRecurringChargeInput {
  tenantId: string;
  branchId?: string | null;
  caseId: string;
  billingType: 'UNDEFINED' | 'BOLETO' | 'CREDIT_CARD' | 'PIX';
  intervalDays: number;
  maxOccurrences?: number | null;
  firstRunAt: Date;
  messageTemplate?: string | null;
  createdByUserId?: string | null;
  createdByUserEmail?: string | null;
}

export interface IRecoveryRecurringChargeRepository {
  create(
    input: CreateRecoveryRecurringChargeInput,
  ): Promise<RecoveryRecurringChargeRecord>;
  findById(
    tenantId: string,
    recurrenceId: string,
  ): Promise<RecoveryRecurringChargeRecord | null>;
  listByCase(
    tenantId: string,
    caseId: string,
  ): Promise<RecoveryRecurringChargeRecord[]>;
  claimDue(now: Date, limit: number): Promise<RecoveryRecurringChargeRecord[]>;
  releaseLease(input: {
    tenantId: string;
    recurrenceId: string;
    errorMessage?: string | null;
  }): Promise<void>;
  startRun(input: {
    recurrenceId: string;
    tenantId: string;
    caseId: string;
    occurrenceNumber: number;
    scheduledFor: Date;
  }): Promise<RecoveryRecurringChargeRunRecord | null>;
  markRunSucceeded(input: {
    runId: string;
    paymentLinkId: string;
    conversationId?: string | null;
    messageId?: string | null;
  }): Promise<void>;
  markRunFailed(input: { runId: string; errorMessage: string }): Promise<void>;
  markRunSkipped(input: { runId: string; reason: string }): Promise<void>;
  advanceAfterSuccess(input: {
    tenantId: string;
    recurrenceId: string;
    occurrenceNumber: number;
    nextRunAt?: Date | null;
  }): Promise<RecoveryRecurringChargeRecord>;
  cancel(input: {
    tenantId: string;
    recurrenceId: string;
    reason?: string;
  }): Promise<RecoveryRecurringChargeRecord>;
  cancelActiveByCase(input: {
    tenantId: string;
    caseId: string;
    reason?: string;
  }): Promise<number>;
}

export const RECOVERY_RECURRING_CHARGE_REPOSITORY = Symbol(
  'RECOVERY_RECURRING_CHARGE_REPOSITORY',
);
