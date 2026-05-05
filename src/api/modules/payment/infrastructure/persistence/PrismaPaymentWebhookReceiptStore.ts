import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { ParsedWebhookEvent } from '../../domain/ports/IPaymentGateway';

export interface WebhookReceiptResult {
  id: string;
  isNew: boolean;
}

@Injectable()
export class PrismaPaymentWebhookReceiptStore {
  constructor(private readonly prisma: PrismaService) {}

  async registerReceived(
    event: ParsedWebhookEvent,
    signature?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<WebhookReceiptResult> {
    const receiptKey = this.buildReceiptKey(event);
    const executor = tx ?? this.prisma;
    const rows = await executor.$queryRaw<
      Array<{ id: string; inserted: boolean }>
    >(Prisma.sql`
        WITH inserted AS (
          INSERT INTO "payment_schema"."payment_webhook_receipts"
            (
              "receipt_key",
              "provider",
              "event_type",
              "payment_id",
              "tenant_id",
              "raw_reference",
              "signature",
              "payload"
            )
          VALUES
            (
              ${receiptKey},
              ${event.provider},
              ${event.eventType},
              ${event.paymentId},
              ${event.tenantId ?? null}::uuid,
              ${event.rawReference ?? null},
              ${signature ?? null},
              ${JSON.stringify(event.rawPayload)}::jsonb
            )
          ON CONFLICT ("receipt_key") DO NOTHING
          RETURNING "id"
        )
        SELECT "id", TRUE AS inserted FROM inserted
        UNION ALL
        SELECT "id", FALSE AS inserted
        FROM "payment_schema"."payment_webhook_receipts"
        WHERE "receipt_key" = ${receiptKey}
        LIMIT 1
      `);

    const receipt = rows[0];
    return {
      id: receipt.id,
      isNew: receipt.inserted,
    };
  }

  async markProcessed(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const executor = tx ?? this.prisma;
    await executor.$executeRaw(Prisma.sql`
        UPDATE "payment_schema"."payment_webhook_receipts"
        SET
          "status" = 'PROCESSED',
          "processed_at" = NOW(),
          "ignore_reason" = NULL,
          "ignored_at" = NULL
        WHERE "id" = ${id}::uuid
      `);
  }

  async markIgnored(
    id: string,
    reason: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const executor = tx ?? this.prisma;
    await executor.$executeRaw(Prisma.sql`
        UPDATE "payment_schema"."payment_webhook_receipts"
        SET
          "status" = 'IGNORED',
          "ignore_reason" = ${reason},
          "ignored_at" = NOW()
        WHERE "id" = ${id}::uuid
      `);
  }

  private buildReceiptKey(event: ParsedWebhookEvent): string {
    return `${event.provider}:${event.eventType}:${event.paymentId}`;
  }
}
