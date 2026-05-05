import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/PrismaService';
import { IInboxStore, InboxRecord } from './InboxStore';

interface ClaimRow {
  id: string;
}

@Injectable()
export class PrismaInboxStore implements IInboxStore {
  constructor(private readonly prisma: PrismaService) {}

  async claim(record: InboxRecord): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<ClaimRow[]>(Prisma.sql`
        INSERT INTO "shared_schema"."inbox_events"
          ("consumer_name", "event_id", "event_type", "queue_name", "payload", "status", "processing_at")
        VALUES
          (
            ${record.consumerName},
            ${record.eventId},
            ${record.eventType},
            ${record.queue},
            ${JSON.stringify(record.payload)}::jsonb,
            'RECEIVED',
            NOW()
          )
        ON CONFLICT ("consumer_name", "event_id") DO NOTHING
        RETURNING "id"
      `);

    return rows[0]?.id ?? null;
  }

  async markProcessed(id: string): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
        UPDATE "shared_schema"."inbox_events"
        SET
          "status" = 'PROCESSED',
          "processing_at" = NULL,
          "processed_at" = NOW(),
          "last_error" = NULL
        WHERE "id" = ${id}::uuid
      `);
  }

  async markFailed(id: string, errorMessage: string): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
        UPDATE "shared_schema"."inbox_events"
        SET
          "status" = 'FAILED',
          "processing_at" = NULL,
          "failed_at" = NOW(),
          "last_error" = ${errorMessage.slice(0, 2000)}
        WHERE "id" = ${id}::uuid
      `);
  }
}
