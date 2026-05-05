import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  CreateRecoveryRecurringChargeInput,
  IRecoveryRecurringChargeRepository,
  RecoveryRecurringChargeRecord,
  RecoveryRecurringChargeRunRecord,
} from '../../../domain/ports/IRecoveryRecurringChargeRepository';

@Injectable()
export class PrismaRecoveryRecurringChargeRepository
  implements IRecoveryRecurringChargeRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async create(
    input: CreateRecoveryRecurringChargeInput,
  ): Promise<RecoveryRecurringChargeRecord> {
    await this.ensureTableShape();

    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      INSERT INTO recovery_schema.recovery_recurring_charges (
        tenant_id,
        branch_id,
        case_id,
        billing_type,
        interval_days,
        max_occurrences,
        first_run_at,
        next_run_at,
        message_template,
        created_by_user_id,
        created_by_user_email
      )
      VALUES (
        ${input.tenantId}::uuid,
        ${input.branchId ?? null}::uuid,
        ${input.caseId}::uuid,
        ${input.billingType},
        ${input.intervalDays},
        ${input.maxOccurrences ?? null},
        ${input.firstRunAt},
        ${input.firstRunAt},
        ${input.messageTemplate ?? null},
        ${input.createdByUserId ?? null}::uuid,
        ${input.createdByUserEmail ?? null}
      )
      RETURNING *
    `);

    return this.mapRecurringCharge(rows[0]);
  }

  async findById(
    tenantId: string,
    recurrenceId: string,
  ): Promise<RecoveryRecurringChargeRecord | null> {
    await this.ensureTableShape();

    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT *
      FROM recovery_schema.recovery_recurring_charges
      WHERE tenant_id = ${tenantId}::uuid
        AND id = ${recurrenceId}::uuid
      LIMIT 1
    `);

    return rows[0] ? this.mapRecurringCharge(rows[0]) : null;
  }

  async listByCase(
    tenantId: string,
    caseId: string,
  ): Promise<RecoveryRecurringChargeRecord[]> {
    await this.ensureTableShape();

    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT *
      FROM recovery_schema.recovery_recurring_charges
      WHERE tenant_id = ${tenantId}::uuid
        AND case_id = ${caseId}::uuid
      ORDER BY created_at DESC
    `);

    return rows.map((row) => this.mapRecurringCharge(row));
  }

  async claimDue(
    now: Date,
    limit: number,
  ): Promise<RecoveryRecurringChargeRecord[]> {
    await this.ensureTableShape();
    const leaseUntil = new Date(now.getTime() + 5 * 60 * 1000);

    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      UPDATE recovery_schema.recovery_recurring_charges AS recurring
      SET lease_until = ${leaseUntil},
          updated_at = NOW()
      WHERE recurring.id IN (
        SELECT id
        FROM recovery_schema.recovery_recurring_charges
        WHERE status = 'ACTIVE'
          AND next_run_at IS NOT NULL
          AND next_run_at <= ${now}
          AND (lease_until IS NULL OR lease_until < ${now})
          AND (max_occurrences IS NULL OR occurrences_sent < max_occurrences)
        ORDER BY next_run_at ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING recurring.*
    `);

    return rows.map((row) => this.mapRecurringCharge(row));
  }

  async releaseLease(input: {
    tenantId: string;
    recurrenceId: string;
    errorMessage?: string | null;
  }): Promise<void> {
    await this.ensureTableShape();

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE recovery_schema.recovery_recurring_charges
      SET lease_until = NULL,
          last_error = ${input.errorMessage ?? null},
          updated_at = NOW()
      WHERE tenant_id = ${input.tenantId}::uuid
        AND id = ${input.recurrenceId}::uuid
    `);
  }

  async startRun(input: {
    recurrenceId: string;
    tenantId: string;
    caseId: string;
    occurrenceNumber: number;
    scheduledFor: Date;
  }): Promise<RecoveryRecurringChargeRunRecord | null> {
    await this.ensureTableShape();

    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      INSERT INTO recovery_schema.recovery_recurring_charge_runs (
        recurrence_id,
        tenant_id,
        case_id,
        occurrence_number,
        scheduled_for,
        status
      )
      VALUES (
        ${input.recurrenceId}::uuid,
        ${input.tenantId}::uuid,
        ${input.caseId}::uuid,
        ${input.occurrenceNumber},
        ${input.scheduledFor},
        'PROCESSING'
      )
      ON CONFLICT (recurrence_id, occurrence_number) DO NOTHING
      RETURNING *
    `);

    return rows[0] ? this.mapRun(rows[0]) : null;
  }

  async markRunSucceeded(input: {
    runId: string;
    paymentLinkId: string;
    conversationId?: string | null;
    messageId?: string | null;
  }): Promise<void> {
    await this.ensureTableShape();

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE recovery_schema.recovery_recurring_charge_runs
      SET status = 'SUCCEEDED',
          payment_link_id = ${input.paymentLinkId},
          conversation_id = ${input.conversationId ?? null}::uuid,
          message_id = ${input.messageId ?? null}::uuid,
          completed_at = NOW()
      WHERE id = ${input.runId}::uuid
    `);
  }

  async markRunFailed(input: {
    runId: string;
    errorMessage: string;
  }): Promise<void> {
    await this.ensureTableShape();

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE recovery_schema.recovery_recurring_charge_runs
      SET status = 'FAILED',
          error_message = ${input.errorMessage},
          completed_at = NOW()
      WHERE id = ${input.runId}::uuid
    `);
  }

  async markRunSkipped(input: { runId: string; reason: string }): Promise<void> {
    await this.ensureTableShape();

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE recovery_schema.recovery_recurring_charge_runs
      SET status = 'SKIPPED',
          error_message = ${input.reason},
          completed_at = NOW()
      WHERE id = ${input.runId}::uuid
    `);
  }

  async advanceAfterSuccess(input: {
    tenantId: string;
    recurrenceId: string;
    occurrenceNumber: number;
    nextRunAt?: Date | null;
  }): Promise<RecoveryRecurringChargeRecord> {
    await this.ensureTableShape();

    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      UPDATE recovery_schema.recovery_recurring_charges
      SET occurrences_sent = ${input.occurrenceNumber},
          last_run_at = NOW(),
          next_run_at = ${input.nextRunAt ?? null},
          status = CASE WHEN ${input.nextRunAt ?? null} IS NULL THEN 'COMPLETED' ELSE status END,
          completed_at = CASE WHEN ${input.nextRunAt ?? null} IS NULL THEN NOW() ELSE completed_at END,
          lease_until = NULL,
          last_error = NULL,
          updated_at = NOW()
      WHERE tenant_id = ${input.tenantId}::uuid
        AND id = ${input.recurrenceId}::uuid
      RETURNING *
    `);

    return this.mapRecurringCharge(rows[0]);
  }

  async cancel(input: {
    tenantId: string;
    recurrenceId: string;
    reason?: string;
  }): Promise<RecoveryRecurringChargeRecord> {
    await this.ensureTableShape();

    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      UPDATE recovery_schema.recovery_recurring_charges
      SET status = 'CANCELLED',
          next_run_at = NULL,
          lease_until = NULL,
          last_error = ${input.reason ?? null},
          cancelled_at = NOW(),
          updated_at = NOW()
      WHERE tenant_id = ${input.tenantId}::uuid
        AND id = ${input.recurrenceId}::uuid
      RETURNING *
    `);

    return this.mapRecurringCharge(rows[0]);
  }

  async cancelActiveByCase(input: {
    tenantId: string;
    caseId: string;
    reason?: string;
  }): Promise<number> {
    await this.ensureTableShape();

    const rows = await this.prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
      WITH updated AS (
        UPDATE recovery_schema.recovery_recurring_charges
        SET status = 'CANCELLED',
            next_run_at = NULL,
            lease_until = NULL,
            last_error = ${input.reason ?? null},
            cancelled_at = NOW(),
            updated_at = NOW()
        WHERE tenant_id = ${input.tenantId}::uuid
          AND case_id = ${input.caseId}::uuid
          AND status = 'ACTIVE'
        RETURNING id
      )
      SELECT COUNT(*)::int AS count FROM updated
    `);

    return Number(rows[0]?.count ?? 0);
  }

  private mapRecurringCharge(row: any): RecoveryRecurringChargeRecord {
    return {
      id: row.id,
      tenantId: row.tenantId ?? row.tenant_id,
      branchId: row.branchId ?? row.branch_id ?? null,
      caseId: row.caseId ?? row.case_id,
      status: row.status,
      billingType: row.billingType ?? row.billing_type,
      intervalDays: Number(row.intervalDays ?? row.interval_days),
      maxOccurrences:
        (row.maxOccurrences ?? row.max_occurrences) == null
          ? null
          : Number(row.maxOccurrences ?? row.max_occurrences),
      occurrencesSent: Number(row.occurrencesSent ?? row.occurrences_sent ?? 0),
      firstRunAt: row.firstRunAt ?? row.first_run_at,
      nextRunAt: row.nextRunAt ?? row.next_run_at ?? null,
      lastRunAt: row.lastRunAt ?? row.last_run_at ?? null,
      messageTemplate: row.messageTemplate ?? row.message_template ?? null,
      lastError: row.lastError ?? row.last_error ?? null,
      leaseUntil: row.leaseUntil ?? row.lease_until ?? null,
      createdByUserId: row.createdByUserId ?? row.created_by_user_id ?? null,
      createdByUserEmail:
        row.createdByUserEmail ?? row.created_by_user_email ?? null,
      cancelledAt: row.cancelledAt ?? row.cancelled_at ?? null,
      completedAt: row.completedAt ?? row.completed_at ?? null,
      createdAt: row.createdAt ?? row.created_at,
      updatedAt: row.updatedAt ?? row.updated_at,
    };
  }

  private mapRun(row: any): RecoveryRecurringChargeRunRecord {
    return {
      id: row.id,
      recurrenceId: row.recurrenceId ?? row.recurrence_id,
      tenantId: row.tenantId ?? row.tenant_id,
      caseId: row.caseId ?? row.case_id,
      occurrenceNumber: Number(row.occurrenceNumber ?? row.occurrence_number),
      scheduledFor: row.scheduledFor ?? row.scheduled_for,
      status: row.status,
      paymentLinkId: row.paymentLinkId ?? row.payment_link_id ?? null,
      conversationId: row.conversationId ?? row.conversation_id ?? null,
      messageId: row.messageId ?? row.message_id ?? null,
      errorMessage: row.errorMessage ?? row.error_message ?? null,
      createdAt: row.createdAt ?? row.created_at,
      completedAt: row.completedAt ?? row.completed_at ?? null,
    };
  }

  async ensureTableShape(): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`CREATE SCHEMA IF NOT EXISTS recovery_schema`);
    await this.prisma.$executeRaw(Prisma.sql`
      CREATE TABLE IF NOT EXISTS recovery_schema.recovery_recurring_charges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        branch_id UUID NULL,
        case_id UUID NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        billing_type VARCHAR(20) NOT NULL DEFAULT 'UNDEFINED',
        interval_days INTEGER NOT NULL,
        max_occurrences INTEGER NULL,
        occurrences_sent INTEGER NOT NULL DEFAULT 0,
        first_run_at TIMESTAMPTZ NOT NULL,
        next_run_at TIMESTAMPTZ NULL,
        last_run_at TIMESTAMPTZ NULL,
        message_template TEXT NULL,
        last_error TEXT NULL,
        lease_until TIMESTAMPTZ NULL,
        created_by_user_id UUID NULL,
        created_by_user_email VARCHAR(255) NULL,
        cancelled_at TIMESTAMPTZ NULL,
        completed_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.prisma.$executeRaw(Prisma.sql`
      CREATE TABLE IF NOT EXISTS recovery_schema.recovery_recurring_charge_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        recurrence_id UUID NOT NULL,
        tenant_id UUID NOT NULL,
        case_id UUID NOT NULL,
        occurrence_number INTEGER NOT NULL,
        scheduled_for TIMESTAMPTZ NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PROCESSING',
        payment_link_id VARCHAR(120) NULL,
        conversation_id UUID NULL,
        message_id UUID NULL,
        error_message TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ NULL,
        UNIQUE (recurrence_id, occurrence_number)
      )
    `);
    await this.prisma.$executeRaw(Prisma.sql`
      CREATE INDEX IF NOT EXISTS idx_recovery_recurring_charges_due
      ON recovery_schema.recovery_recurring_charges (status, next_run_at, lease_until)
    `);
    await this.prisma.$executeRaw(Prisma.sql`
      CREATE INDEX IF NOT EXISTS idx_recovery_recurring_charges_case
      ON recovery_schema.recovery_recurring_charges (tenant_id, case_id)
    `);
    await this.prisma.$executeRaw(Prisma.sql`
      CREATE INDEX IF NOT EXISTS idx_recovery_recurring_charge_runs_case
      ON recovery_schema.recovery_recurring_charge_runs (tenant_id, case_id, created_at DESC)
    `);
  }
}
