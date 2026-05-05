CREATE SCHEMA IF NOT EXISTS "shared_schema";

CREATE TABLE IF NOT EXISTS "shared_schema"."outbox_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_id" VARCHAR(255) NOT NULL,
    "event_type" VARCHAR(255) NOT NULL,
    "queue_name" VARCHAR(255) NOT NULL,
    "source_module" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "event_timestamp" TIMESTAMPTZ NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "processing_at" TIMESTAMPTZ,
    "published_at" TIMESTAMPTZ,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "outbox_events_event_id_key"
ON "shared_schema"."outbox_events"("event_id");

CREATE INDEX IF NOT EXISTS "idx_outbox_pending"
ON "shared_schema"."outbox_events"("published_at", "created_at");

CREATE INDEX IF NOT EXISTS "idx_outbox_processing"
ON "shared_schema"."outbox_events"("processing_at");
