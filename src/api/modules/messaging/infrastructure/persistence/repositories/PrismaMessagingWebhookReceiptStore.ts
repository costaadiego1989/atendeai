import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';

export interface MessagingWebhookReceiptInput {
  channel: 'WHATSAPP' | 'INSTAGRAM';
  provider: string;
  externalMessageId: string;
  externalAccountId?: string;
  fromPhone?: string;
  toPhone?: string;
  signature?: string;
  payload: Record<string, unknown>;
}

export interface MessagingWebhookReceiptResult {
  id: string;
  isNew: boolean;
}

@Injectable()
export class PrismaMessagingWebhookReceiptStore {
  constructor(private readonly prisma: PrismaService) {}

  async registerReceived(
    input: MessagingWebhookReceiptInput,
    tx?: Prisma.TransactionClient,
  ): Promise<MessagingWebhookReceiptResult> {
    const receiptKey = this.buildReceiptKey(input);
    const executor = tx ?? this.prisma;
    const rows = await executor.$queryRaw<
      Array<{ id: string; inserted: boolean }>
    >(Prisma.sql`
        WITH inserted AS (
          INSERT INTO "messaging_schema"."messaging_webhook_receipts"
            (
              "receipt_key",
              "channel",
              "provider",
              "external_message_id",
              "external_account_id",
              "from_phone",
              "to_phone",
              "signature",
              "payload"
            )
          VALUES
            (
              ${receiptKey},
              ${input.channel},
              ${input.provider},
              ${input.externalMessageId},
              ${input.externalAccountId ?? null},
              ${input.fromPhone ?? null},
              ${input.toPhone ?? null},
              ${input.signature ?? null},
              ${JSON.stringify(input.payload)}::jsonb
            )
          ON CONFLICT ("receipt_key") DO NOTHING
          RETURNING "id"
        )
        SELECT "id", TRUE AS inserted FROM inserted
        UNION ALL
        SELECT "id", FALSE AS inserted
        FROM "messaging_schema"."messaging_webhook_receipts"
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
        UPDATE "messaging_schema"."messaging_webhook_receipts"
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
        UPDATE "messaging_schema"."messaging_webhook_receipts"
        SET
          "status" = 'IGNORED',
          "ignore_reason" = ${reason},
          "ignored_at" = NOW()
        WHERE "id" = ${id}::uuid
      `);
  }

  private buildReceiptKey(input: MessagingWebhookReceiptInput): string {
    return `${input.provider}:${input.channel}:${input.externalMessageId}`;
  }
}
