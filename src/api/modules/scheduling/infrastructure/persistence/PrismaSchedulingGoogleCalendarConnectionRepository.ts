import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  ISchedulingGoogleCalendarConnectionRepository,
} from '../../domain/ports/ISchedulingGoogleCalendarConnectionRepository';
import { SchedulingGoogleCalendarConnection } from '../../domain/types/SchedulingGoogleCalendarConnection';

@Injectable()
export class PrismaSchedulingGoogleCalendarConnectionRepository
  implements ISchedulingGoogleCalendarConnectionRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async save(connection: SchedulingGoogleCalendarConnection): Promise<void> {
    const existing = await this.findByScope(connection.tenantId, connection.branchId);

    if (existing) {
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE scheduling_schema.google_calendar_connection_scopes
        SET
          refresh_token = ${connection.refreshToken},
          calendar_id = ${connection.calendarId ?? null},
          status = ${connection.status},
          updated_at = NOW()
        WHERE tenant_id = ${connection.tenantId}::uuid
          AND ${connection.branchId ? Prisma.sql`branch_id = ${connection.branchId}::uuid` : Prisma.sql`branch_id IS NULL`}
      `);
    } else {
      await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO scheduling_schema.google_calendar_connection_scopes (
          tenant_id, branch_id, user_id, refresh_token, calendar_id, status, created_at, updated_at
        ) VALUES (
          ${connection.tenantId}::uuid,
          ${connection.branchId ?? null}::uuid,
          ${connection.tenantId}::uuid,
          ${connection.refreshToken},
          ${connection.calendarId ?? null},
          ${connection.status},
          NOW(),
          NOW()
        )
      `);
    }
  }

  async findByScope(
    tenantId: string,
    branchId?: string | null,
  ): Promise<SchedulingGoogleCalendarConnection | null> {
    const branchCondition = branchId
      ? Prisma.sql`branch_id = ${branchId}::uuid`
      : Prisma.sql`branch_id IS NULL`;

    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT *
      FROM scheduling_schema.google_calendar_connection_scopes
      WHERE tenant_id = ${tenantId}::uuid
        AND ${branchCondition}
      LIMIT 1
    `);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      tenantId: row.tenant_id,
      branchId: row.branch_id ?? undefined,
      refreshToken: row.refresh_token,
      calendarId: row.calendar_id,
      status: row.status,
      connectedAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }

  async findBestForScope(
    tenantId: string,
    branchId?: string | null,
  ): Promise<SchedulingGoogleCalendarConnection | null> {
    if (branchId) {
      const branchConnection = await this.findByScope(tenantId, branchId);
      if (branchConnection) {
        return branchConnection;
      }
    }

    return this.findByScope(tenantId, null);
  }

  async deleteByScope(tenantId: string, branchId?: string | null): Promise<void> {
    const branchCondition = branchId
      ? Prisma.sql`branch_id = ${branchId}::uuid`
      : Prisma.sql`branch_id IS NULL`;

    await this.prisma.$executeRaw(Prisma.sql`
      DELETE FROM scheduling_schema.google_calendar_connection_scopes
      WHERE tenant_id = ${tenantId}::uuid
        AND ${branchCondition}
    `);
  }
}
