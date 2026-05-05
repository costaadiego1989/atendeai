CREATE TABLE IF NOT EXISTS "messaging_schema"."messaging_webhook_receipts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "receipt_key" VARCHAR(255) NOT NULL,
    "channel" VARCHAR(20) NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "external_message_id" VARCHAR(255) NOT NULL,
    "external_account_id" VARCHAR(255),
    "from_phone" VARCHAR(30),
    "to_phone" VARCHAR(30),
    "signature" TEXT,
    "payload" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'RECEIVED',
    "ignore_reason" VARCHAR(100),
    "processed_at" TIMESTAMPTZ,
    "ignored_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messaging_webhook_receipts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "messaging_webhook_receipts_receipt_key_key"
ON "messaging_schema"."messaging_webhook_receipts"("receipt_key");

CREATE INDEX IF NOT EXISTS "idx_messaging_webhook_receipts_status"
ON "messaging_schema"."messaging_webhook_receipts"("status", "created_at");
