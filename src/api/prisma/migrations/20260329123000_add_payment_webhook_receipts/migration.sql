CREATE SCHEMA IF NOT EXISTS "payment_schema";

CREATE TABLE IF NOT EXISTS "payment_schema"."payment_webhook_receipts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "receipt_key" VARCHAR(255) NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "payment_id" VARCHAR(100) NOT NULL,
    "tenant_id" UUID,
    "raw_reference" VARCHAR(255),
    "signature" TEXT,
    "payload" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'RECEIVED',
    "ignore_reason" VARCHAR(100),
    "processed_at" TIMESTAMPTZ,
    "ignored_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_webhook_receipts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_webhook_receipts_receipt_key_key"
ON "payment_schema"."payment_webhook_receipts"("receipt_key");

CREATE INDEX IF NOT EXISTS "idx_payment_webhook_receipts_status"
ON "payment_schema"."payment_webhook_receipts"("status", "created_at");
