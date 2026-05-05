CREATE TABLE "shared_schema"."inbox_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "consumer_name" VARCHAR(255) NOT NULL,
  "event_id" VARCHAR(255) NOT NULL,
  "event_type" VARCHAR(255) NOT NULL,
  "queue_name" VARCHAR(255) NOT NULL,
  "payload" JSONB NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'RECEIVED',
  "processing_at" TIMESTAMPTZ NULL,
  "processed_at" TIMESTAMPTZ NULL,
  "failed_at" TIMESTAMPTZ NULL,
  "last_error" TEXT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "pk_inbox_events" PRIMARY KEY ("id"),
  CONSTRAINT "uq_inbox_consumer_event" UNIQUE ("consumer_name", "event_id")
);

CREATE INDEX "idx_inbox_status"
  ON "shared_schema"."inbox_events" ("status", "created_at");

CREATE INDEX "idx_inbox_processing"
  ON "shared_schema"."inbox_events" ("processing_at");
