import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/PrismaService';
import { IntegrationEvent } from '../../application/ports/IntegrationEvent';
import { IOutboxStore, StoredOutboxEvent } from './OutboxStore';

interface RawOutboxRow {
  id: string;
  event_id: string;
  event_type: string;
  queue_name: string;
  source_module: string;
  payload: Record<string, unknown> | string;
  event_timestamp: Date | string;
  attempt_count: number;
  created_at: Date | string;
}

@Injectable()
export class PrismaOutboxStore implements IOutboxStore {
  constructor(private readonly prisma: PrismaService) {}

  async append(
    event: IntegrationEvent,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const serializedEvent = event.toJSON();
    const executor = tx ?? this.prisma;

    await executor.$executeRaw(Prisma.sql`
        INSERT INTO "shared_schema"."outbox_events"
          ("event_id", "event_type", "queue_name", "source_module", "payload", "event_timestamp")
        VALUES
          (
            ${event.eventId},
            ${event.constructor.name},
            ${event.queue},
            ${event.sourceModule},
            ${JSON.stringify(serializedEvent.payload)}::jsonb,
            ${serializedEvent.timestamp}::timestamptz
          )
        ON CONFLICT ("event_id") DO NOTHING
      `);
  }

  async claimPending(batchSize: number): Promise<StoredOutboxEvent[]> {
    const rows = await this.prisma.$queryRaw<RawOutboxRow[]>(Prisma.sql`
        WITH next_events AS (
          SELECT "id"
          FROM "shared_schema"."outbox_events"
          WHERE "published_at" IS NULL
            AND (
              "processing_at" IS NULL
              OR "processing_at" < NOW() - INTERVAL '5 minutes'
            )
          ORDER BY "created_at" ASC
          LIMIT ${batchSize}
          FOR UPDATE SKIP LOCKED
        )
        UPDATE "shared_schema"."outbox_events" AS outbox
        SET
          "processing_at" = NOW(),
          "attempt_count" = outbox."attempt_count" + 1,
          "last_error" = NULL
        FROM next_events
        WHERE outbox."id" = next_events."id"
        RETURNING
          outbox."id",
          outbox."event_id",
          outbox."event_type",
          outbox."queue_name",
          outbox."source_module",
          outbox."payload",
          outbox."event_timestamp",
          outbox."attempt_count",
          outbox."created_at"
      `);

    return rows.map((row) => ({
      id: row.id,
      eventId: row.event_id,
      eventType: row.event_type,
      queue: row.queue_name,
      sourceModule: row.source_module,
      payload:
        typeof row.payload === 'string'
          ? (JSON.parse(row.payload) as Record<string, unknown>)
          : row.payload,
      timestamp: new Date(row.event_timestamp).toISOString(),
      attemptCount: row.attempt_count,
      createdAt: new Date(row.created_at),
    }));
  }

  async markPublished(id: string): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
        UPDATE "shared_schema"."outbox_events"
        SET
          "published_at" = NOW(),
          "processing_at" = NULL,
          "last_error" = NULL
        WHERE "id" = ${id}
      `);
  }

  async markFailed(id: string, errorMessage: string): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
        UPDATE "shared_schema"."outbox_events"
        SET
          "processing_at" = NULL,
          "last_error" = ${errorMessage.slice(0, 2000)}
        WHERE "id" = ${id}
      `);
  }
}
