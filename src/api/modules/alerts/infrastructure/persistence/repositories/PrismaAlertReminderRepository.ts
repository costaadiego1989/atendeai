import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  IAlertReminderRepository,
} from '../../../domain/repositories/IAlertReminderRepository';
import { AlertReminder } from '../../../domain/types/AlertReminder';

@Injectable()
export class PrismaAlertReminderRepository implements IAlertReminderRepository {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureTable(): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      CREATE SCHEMA IF NOT EXISTS alerts_schema
    `);
    await this.prisma.$executeRaw(Prisma.sql`
      CREATE TABLE IF NOT EXISTS alerts_schema.alert_reminders (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        branch_id UUID,
        user_id UUID NOT NULL,
        user_name VARCHAR(255) NOT NULL,
        user_phone VARCHAR(40) NOT NULL,
        user_email VARCHAR(255),
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        frequency VARCHAR(20) NOT NULL,
        scheduled_at TIMESTAMPTZ,
        time_of_day VARCHAR(5),
        next_trigger_at TIMESTAMPTZ,
        last_triggered_at TIMESTAMPTZ,
        status VARCHAR(20) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.prisma.$executeRaw(Prisma.sql`
      ALTER TABLE alerts_schema.alert_reminders
      ADD COLUMN IF NOT EXISTS timezone VARCHAR(80)
    `);
    await this.prisma.$executeRaw(Prisma.sql`
      ALTER TABLE alerts_schema.alert_reminders
      ADD COLUMN IF NOT EXISTS branch_id UUID
    `);
    await this.prisma.$executeRaw(Prisma.sql`
      CREATE INDEX IF NOT EXISTS idx_alert_reminders_tenant_branch
      ON alerts_schema.alert_reminders (tenant_id, branch_id)
    `);
  }

  async save(reminder: AlertReminder): Promise<void> {
    await this.ensureTable();
    await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO alerts_schema.alert_reminders (
          id, tenant_id, branch_id, user_id, user_name, user_phone, user_email,
          timezone, title, message,
          frequency, scheduled_at, time_of_day, next_trigger_at, last_triggered_at,
          status, created_at, updated_at
        )
        VALUES (
          ${reminder.id}::uuid,
          ${reminder.tenantId}::uuid,
          ${reminder.branchId ?? null}::uuid,
          ${reminder.userId}::uuid,
          ${reminder.userName},
          ${reminder.userPhone},
          ${reminder.userEmail ?? null},
          ${reminder.timezone ?? null},
          ${reminder.title},
          ${reminder.message},
          ${reminder.frequency},
          ${reminder.scheduledAt ?? null}::timestamptz,
          ${reminder.timeOfDay ?? null},
          ${reminder.nextTriggerAt ?? null}::timestamptz,
          ${reminder.lastTriggeredAt ?? null}::timestamptz,
          ${reminder.status},
          ${reminder.createdAt}::timestamptz,
          ${reminder.updatedAt}::timestamptz
        )
        ON CONFLICT (id) DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          branch_id = EXCLUDED.branch_id,
          user_id = EXCLUDED.user_id,
          user_name = EXCLUDED.user_name,
          user_phone = EXCLUDED.user_phone,
          user_email = EXCLUDED.user_email,
          timezone = EXCLUDED.timezone,
          title = EXCLUDED.title,
          message = EXCLUDED.message,
          frequency = EXCLUDED.frequency,
          scheduled_at = EXCLUDED.scheduled_at,
          time_of_day = EXCLUDED.time_of_day,
          next_trigger_at = EXCLUDED.next_trigger_at,
          last_triggered_at = EXCLUDED.last_triggered_at,
          status = EXCLUDED.status,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at
      `);
  }

  async findById(tenantId: string, reminderId: string): Promise<AlertReminder | null> {
    await this.ensureTable();
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT *
        FROM alerts_schema.alert_reminders
        WHERE tenant_id = ${tenantId}::uuid AND id = ${reminderId}::uuid
        LIMIT 1
      `);
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async findAllByUser(
    tenantId: string,
    userId: string,
    branchId?: string,
  ): Promise<AlertReminder[]> {
    await this.ensureTable();
    const rows = branchId
      ? await this.prisma.$queryRaw<any[]>(Prisma.sql`
            SELECT *
            FROM alerts_schema.alert_reminders
            WHERE tenant_id = ${tenantId}::uuid
              AND user_id = ${userId}::uuid
              AND branch_id = ${branchId}::uuid
            ORDER BY created_at DESC
          `)
      : await this.prisma.$queryRaw<any[]>(Prisma.sql`
            SELECT *
            FROM alerts_schema.alert_reminders
            WHERE tenant_id = ${tenantId}::uuid
              AND user_id = ${userId}::uuid
            ORDER BY created_at DESC
          `);
    return rows.map((row) => this.toDomain(row));
  }

  async delete(tenantId: string, reminderId: string): Promise<void> {
    await this.ensureTable();
    await this.prisma.$executeRaw(Prisma.sql`
        DELETE FROM alerts_schema.alert_reminders
        WHERE tenant_id = ${tenantId}::uuid AND id = ${reminderId}::uuid
      `);
  }

  async countActiveByUser(tenantId: string, userId: string): Promise<number> {
    await this.ensureTable();
    const rows = await this.prisma.$queryRaw<{ c: bigint }[]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS c
        FROM alerts_schema.alert_reminders
        WHERE tenant_id = ${tenantId}::uuid
          AND user_id = ${userId}::uuid
          AND status = 'ACTIVE'
      `);
    return Number(rows[0]?.c ?? 0);
  }

  async countRecipientDispatchesSince(
    tenantId: string,
    userPhone: string,
    sinceIso: string,
  ): Promise<number> {
    await this.ensureTable();
    const rows = await this.prisma.$queryRaw<{ c: bigint }[]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS c
        FROM alerts_schema.alert_reminders
        WHERE tenant_id = ${tenantId}::uuid
          AND user_phone = ${userPhone}
          AND last_triggered_at IS NOT NULL
          AND last_triggered_at >= ${sinceIso}::timestamptz
      `);
    return Number(rows[0]?.c ?? 0);
  }

  private toDomain(row: any): AlertReminder {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id ?? undefined,
      userId: row.user_id,
      userName: row.user_name,
      userPhone: row.user_phone,
      userEmail: row.user_email ?? undefined,
      timezone: row.timezone ?? null,
      title: row.title,
      message: row.message,
      frequency: row.frequency,
      scheduledAt: row.scheduled_at ? new Date(row.scheduled_at).toISOString() : undefined,
      timeOfDay: row.time_of_day ?? undefined,
      nextTriggerAt: row.next_trigger_at ? new Date(row.next_trigger_at).toISOString() : undefined,
      lastTriggeredAt: row.last_triggered_at ? new Date(row.last_triggered_at).toISOString() : undefined,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }
}
