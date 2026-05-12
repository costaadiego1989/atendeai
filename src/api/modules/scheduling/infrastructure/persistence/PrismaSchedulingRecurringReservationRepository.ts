import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  CreateSchedulingRecurringReservationInput,
  ISchedulingRecurringReservationRepository,
  SchedulingRecurringReservationRecord,
  SchedulingRecurringReservationRunRecord,
  SchedulingRecurringReservationStatus,
} from '../../domain/ports/ISchedulingRecurringReservationRepository';

@Injectable()
export class PrismaSchedulingRecurringReservationRepository
  implements ISchedulingRecurringReservationRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async create(
    input: CreateSchedulingRecurringReservationInput,
  ): Promise<SchedulingRecurringReservationRecord> {

    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      INSERT INTO scheduling_schema.scheduling_recurring_reservations (
        tenant_id,
        branch_id,
        professional_id,
        contact_id,
        category_id,
        conversation_id,
        period,
        interval,
        max_occurrences,
        occurrences_created,
        starts_at,
        ends_at,
        first_date,
        end_date,
        next_date,
        next_run_at,
        is_free,
        is_online,
        payment_timeout_hours,
        notes
      )
      VALUES (
        ${input.tenantId}::uuid,
        ${input.branchId ?? null}::uuid,
        ${input.professionalId},
        ${input.contactId ?? null}::uuid,
        ${input.categoryId ?? null},
        ${input.conversationId ?? null}::uuid,
        ${input.period},
        ${input.interval ?? 1},
        ${input.maxOccurrences},
        ${input.occurrencesCreated},
        ${input.startsAt},
        ${input.endsAt},
        ${input.firstDate}::date,
        ${input.endDate ?? null}::date,
        ${input.nextDate ?? null}::date,
        ${input.nextRunAt ?? null},
        ${input.isFree},
        ${input.isOnline},
        ${input.paymentTimeoutHours ?? null},
        ${input.notes ?? null}
      )
      RETURNING *
    `);
    return this.mapReservation(rows[0]);
  }

  async findById(
    tenantId: string,
    recurrenceId: string,
  ): Promise<SchedulingRecurringReservationRecord | null> {

    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT *
      FROM scheduling_schema.scheduling_recurring_reservations
      WHERE tenant_id = ${tenantId}::uuid
        AND id = ${recurrenceId}::uuid
      LIMIT 1
    `);
    return rows[0] ? this.mapReservation(rows[0]) : null;
  }

  async list(input: {
    tenantId: string;
    professionalId?: string | null;
    status?: SchedulingRecurringReservationStatus | null;
  }): Promise<SchedulingRecurringReservationRecord[]> {

    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT *
      FROM scheduling_schema.scheduling_recurring_reservations
      WHERE tenant_id = ${input.tenantId}::uuid
        AND (${input.professionalId ?? null}::text IS NULL OR professional_id = ${input.professionalId ?? null})
        AND (${input.status ?? null}::text IS NULL OR status = ${input.status ?? null})
      ORDER BY created_at DESC
    `);
    return rows.map((row) => this.mapReservation(row));
  }

  async claimDue(
    now: Date,
    limit: number,
  ): Promise<SchedulingRecurringReservationRecord[]> {

    const leaseUntil = new Date(now.getTime() + 5 * 60 * 1000);
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      UPDATE scheduling_schema.scheduling_recurring_reservations AS recurrence
      SET lease_until = ${leaseUntil},
          updated_at = NOW()
      WHERE recurrence.id IN (
        SELECT id
        FROM scheduling_schema.scheduling_recurring_reservations
        WHERE status = 'ACTIVE'
          AND next_run_at IS NOT NULL
          AND next_run_at <= ${now}
          AND occurrences_created < max_occurrences
          AND (lease_until IS NULL OR lease_until < ${now})
        ORDER BY next_run_at ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING recurrence.*
    `);
    return rows.map((row) => this.mapReservation(row));
  }

  async releaseLease(input: {
    tenantId: string;
    recurrenceId: string;
    errorMessage?: string | null;
  }): Promise<void> {

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE scheduling_schema.scheduling_recurring_reservations
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
    occurrenceNumber: number;
    targetDate: string;
  }): Promise<SchedulingRecurringReservationRunRecord | null> {

    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      INSERT INTO scheduling_schema.scheduling_recurring_reservation_runs (
        recurrence_id,
        tenant_id,
        occurrence_number,
        target_date,
        status
      )
      VALUES (
        ${input.recurrenceId}::uuid,
        ${input.tenantId}::uuid,
        ${input.occurrenceNumber},
        ${input.targetDate}::date,
        'PROCESSING'
      )
      ON CONFLICT (recurrence_id, occurrence_number) DO NOTHING
      RETURNING *
    `);
    return rows[0] ? this.mapRun(rows[0]) : null;
  }

  async markRunSucceeded(input: {
    runId: string;
    slotId: string;
  }): Promise<void> {

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE scheduling_schema.scheduling_recurring_reservation_runs
      SET status = 'SUCCEEDED',
          slot_id = ${input.slotId},
          completed_at = NOW()
      WHERE id = ${input.runId}::uuid
    `);
  }

  async markRunFailed(input: {
    runId: string;
    errorMessage: string;
  }): Promise<void> {

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE scheduling_schema.scheduling_recurring_reservation_runs
      SET status = 'FAILED',
          error_message = ${input.errorMessage},
          completed_at = NOW()
      WHERE id = ${input.runId}::uuid
    `);
  }

  async markRunSkipped(input: { runId: string; reason: string }): Promise<void> {

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE scheduling_schema.scheduling_recurring_reservation_runs
      SET status = 'SKIPPED',
          error_message = ${input.reason},
          completed_at = NOW()
      WHERE id = ${input.runId}::uuid
    `);
  }

  async advanceAfterSuccess(input: {
    tenantId: string;
    recurrenceId: string;
    occurrencesCreated: number;
    nextDate?: string | null;
    nextRunAt?: Date | null;
  }): Promise<SchedulingRecurringReservationRecord> {

    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      UPDATE scheduling_schema.scheduling_recurring_reservations
      SET occurrences_created = ${input.occurrencesCreated},
          next_date = ${input.nextDate ?? null}::date,
          next_run_at = ${input.nextRunAt ?? null},
          lease_until = NULL,
          last_error = NULL,
          updated_at = NOW()
      WHERE tenant_id = ${input.tenantId}::uuid
        AND id = ${input.recurrenceId}::uuid
      RETURNING *
    `);
    return this.mapReservation(rows[0]);
  }

  async cancel(input: {
    tenantId: string;
    recurrenceId: string;
    reason?: string;
  }): Promise<SchedulingRecurringReservationRecord> {

    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      UPDATE scheduling_schema.scheduling_recurring_reservations
      SET status = 'CANCELLED',
          next_date = NULL,
          next_run_at = NULL,
          lease_until = NULL,
          last_error = ${input.reason ?? null},
          cancelled_at = NOW(),
          updated_at = NOW()
      WHERE tenant_id = ${input.tenantId}::uuid
        AND id = ${input.recurrenceId}::uuid
      RETURNING *
    `);
    return this.mapReservation(rows[0]);
  }

  async delete(input: {
    tenantId: string;
    recurrenceId: string;
  }): Promise<void> {

    await this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw(Prisma.sql`
        DELETE FROM scheduling_schema.scheduling_recurring_reservation_runs
        WHERE tenant_id = ${input.tenantId}::uuid
          AND recurrence_id = ${input.recurrenceId}::uuid
      `);
      await transaction.$executeRaw(Prisma.sql`
        DELETE FROM scheduling_schema.scheduling_recurring_reservations
        WHERE tenant_id = ${input.tenantId}::uuid
          AND id = ${input.recurrenceId}::uuid
      `);
    });
  }

  private mapReservation(row: any): SchedulingRecurringReservationRecord {
    const rawNextDate = row.nextDate ?? row.next_date;

    return {
      id: row.id,
      tenantId: row.tenantId ?? row.tenant_id,
      branchId: row.branchId ?? row.branch_id ?? null,
      professionalId: row.professionalId ?? row.professional_id,
      contactId: row.contactId ?? row.contact_id ?? null,
      categoryId: row.categoryId ?? row.category_id ?? null,
      conversationId: row.conversationId ?? row.conversation_id ?? null,
      period: row.period,
      interval: Number(row.interval ?? 1),
      maxOccurrences: Number(row.maxOccurrences ?? row.max_occurrences),
      occurrencesCreated: Number(
        row.occurrencesCreated ?? row.occurrences_created,
      ),
      startsAt: row.startsAt ?? row.starts_at,
      endsAt: row.endsAt ?? row.ends_at,
      firstDate: this.toDateString(row.firstDate ?? row.first_date),
      endDate:
        (row.endDate ?? row.end_date) == null
          ? null
          : this.toDateString(row.endDate ?? row.end_date),
      nextDate: rawNextDate == null ? null : this.toDateString(rawNextDate),
      nextRunAt: row.nextRunAt ?? row.next_run_at ?? null,
      isFree: Boolean(row.isFree ?? row.is_free),
      isOnline: Boolean(row.isOnline ?? row.is_online),
      paymentTimeoutHours:
        (row.paymentTimeoutHours ?? row.payment_timeout_hours) == null
          ? null
          : Number(row.paymentTimeoutHours ?? row.payment_timeout_hours),
      notes: row.notes ?? null,
      status: row.status,
      lastError: row.lastError ?? row.last_error ?? null,
      leaseUntil: row.leaseUntil ?? row.lease_until ?? null,
      createdAt: row.createdAt ?? row.created_at,
      updatedAt: row.updatedAt ?? row.updated_at,
      completedAt: row.completedAt ?? row.completed_at ?? null,
      cancelledAt: row.cancelledAt ?? row.cancelled_at ?? null,
    };
  }

  private mapRun(row: any): SchedulingRecurringReservationRunRecord {
    return {
      id: row.id,
      recurrenceId: row.recurrenceId ?? row.recurrence_id,
      tenantId: row.tenantId ?? row.tenant_id,
      occurrenceNumber: Number(row.occurrenceNumber ?? row.occurrence_number),
      targetDate: this.toDateString(row.targetDate ?? row.target_date),
      status: row.status,
      slotId: row.slotId ?? row.slot_id ?? null,
      errorMessage: row.errorMessage ?? row.error_message ?? null,
      createdAt: row.createdAt ?? row.created_at,
      completedAt: row.completedAt ?? row.completed_at ?? null,
    };
  }

  private toDateString(value: Date | string): string {
    return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  }
}
