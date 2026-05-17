import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  ISchedulingGoogleCalendarEventLinkRepository,
  SchedulingGoogleCalendarEventLink,
} from '../../domain/ports/ISchedulingGoogleCalendarEventLinkRepository';

@Injectable()
export class PrismaSchedulingGoogleCalendarEventLinkRepository implements ISchedulingGoogleCalendarEventLinkRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(link: SchedulingGoogleCalendarEventLink): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO scheduling_schema.google_calendar_event_links (
          tenant_id, branch_id, professional_id, date, slot_id, event_id, created_at, updated_at
        ) VALUES (
          ${link.tenantId}::uuid,
          ${link.branchId ?? null}::uuid,
          ${link.professionalId},
          ${link.date}::date,
          ${link.slotId},
          ${link.eventId},
          ${link.createdAt}::timestamptz,
          ${link.updatedAt}::timestamptz
        )
        ON CONFLICT (tenant_id, professional_id, date, slot_id) DO UPDATE SET
          event_id = EXCLUDED.event_id,
          branch_id = EXCLUDED.branch_id,
          updated_at = EXCLUDED.updated_at
      `);
  }

  async findBySlot(input: {
    tenantId: string;
    professionalId: string;
    date: string;
    slotId: string;
  }): Promise<SchedulingGoogleCalendarEventLink | null> {
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT *
        FROM scheduling_schema.google_calendar_event_links
        WHERE tenant_id = ${input.tenantId}::uuid
          AND professional_id = ${input.professionalId}
          AND date = ${input.date}::date
          AND slot_id = ${input.slotId}
        LIMIT 1
      `);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      tenantId: row.tenant_id,
      branchId: row.branch_id ?? undefined,
      professionalId: row.professional_id,
      date: new Date(row.date).toISOString().slice(0, 10),
      slotId: row.slot_id,
      eventId: row.event_id,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }

  async reassignSlot(input: {
    tenantId: string;
    sourceProfessionalId: string;
    sourceDate: string;
    sourceSlotId: string;
    targetProfessionalId: string;
    targetDate: string;
    targetSlotId: string;
    branchId?: string | null;
    updatedAt: string;
  }): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
        UPDATE scheduling_schema.google_calendar_event_links
        SET professional_id = ${input.targetProfessionalId},
            date = ${input.targetDate}::date,
            slot_id = ${input.targetSlotId},
            branch_id = ${input.branchId ?? null}::uuid,
            updated_at = ${input.updatedAt}::timestamptz
        WHERE tenant_id = ${input.tenantId}::uuid
          AND professional_id = ${input.sourceProfessionalId}
          AND date = ${input.sourceDate}::date
          AND slot_id = ${input.sourceSlotId}
      `);
  }

  async deleteBySlot(input: {
    tenantId: string;
    professionalId: string;
    date: string;
    slotId: string;
  }): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
        DELETE FROM scheduling_schema.google_calendar_event_links
        WHERE tenant_id = ${input.tenantId}::uuid
          AND professional_id = ${input.professionalId}
          AND date = ${input.date}::date
          AND slot_id = ${input.slotId}
      `);
  }
}
