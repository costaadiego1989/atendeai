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

  private buildScopeKey(tenantId: string, branchId?: string | null) {
    return `${tenantId}:${branchId ?? 'global'}`;
  }

  async save(connection: SchedulingGoogleCalendarConnection): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO scheduling_schema.google_calendar_connection_scopes (
          scope_key, tenant_id, branch_id, google_email, refresh_token, calendar_id, status, connected_at, updated_at
        ) VALUES (
          ${this.buildScopeKey(connection.tenantId, connection.branchId)},
          ${connection.tenantId}::uuid,
          ${connection.branchId ?? null}::uuid,
          ${connection.googleEmail ?? null},
          ${connection.refreshToken},
          ${connection.calendarId},
          ${connection.status},
          ${connection.connectedAt}::timestamptz,
          ${connection.updatedAt}::timestamptz
        )
        ON CONFLICT (scope_key) DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          branch_id = EXCLUDED.branch_id,
          google_email = EXCLUDED.google_email,
          refresh_token = EXCLUDED.refresh_token,
          calendar_id = EXCLUDED.calendar_id,
          status = EXCLUDED.status,
          connected_at = EXCLUDED.connected_at,
          updated_at = EXCLUDED.updated_at
      `);
  }

  async findByScope(
    tenantId: string,
    branchId?: string | null,
  ): Promise<SchedulingGoogleCalendarConnection | null> {
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT *
        FROM scheduling_schema.google_calendar_connection_scopes
        WHERE scope_key = ${this.buildScopeKey(tenantId, branchId)}
        LIMIT 1
      `);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      tenantId: row.tenant_id,
      branchId: row.branch_id ?? undefined,
      googleEmail: row.google_email ?? undefined,
      refreshToken: row.refresh_token,
      calendarId: row.calendar_id,
      status: row.status,
      connectedAt: new Date(row.connected_at).toISOString(),
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
    await this.prisma.$executeRaw(Prisma.sql`
        DELETE FROM scheduling_schema.google_calendar_connection_scopes
        WHERE scope_key = ${this.buildScopeKey(tenantId, branchId)}
      `);
  }
}
