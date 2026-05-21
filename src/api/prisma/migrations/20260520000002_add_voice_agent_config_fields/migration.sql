-- Create voice_calls table (may not exist in production)
CREATE TABLE IF NOT EXISTS "messaging_schema"."voice_calls" (
  "id"               UUID          NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"        UUID          NOT NULL,
  "contact_id"       UUID          NOT NULL,
  "recovery_case_id" UUID,
  "direction"        VARCHAR(10)   NOT NULL,
  "status"           VARCHAR(20)   NOT NULL DEFAULT 'QUEUED',
  "duration"         INTEGER,
  "recording_url"    TEXT,
  "transcript"       JSONB,
  "sentiment"        VARCHAR(20),
  "outcome"          VARCHAR(20),
  "negotiation"      JSONB,
  "external_call_id" VARCHAR(100),
  "created_at"       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  "updated_at"       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT "voice_calls_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_voice_calls_tenant_status"   ON "messaging_schema"."voice_calls"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "idx_voice_calls_tenant_contact"  ON "messaging_schema"."voice_calls"("tenant_id", "contact_id");
CREATE INDEX IF NOT EXISTS "idx_voice_calls_recovery_case"   ON "messaging_schema"."voice_calls"("recovery_case_id");

-- Create voice_agent_configs table with all columns (including new ones)
CREATE TABLE IF NOT EXISTS "messaging_schema"."voice_agent_configs" (
  "id"                   UUID          NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"            UUID          NOT NULL,
  "enabled"              BOOLEAN       NOT NULL DEFAULT false,
  "voice_id"             VARCHAR(100)  NOT NULL DEFAULT '',
  "language"             VARCHAR(10)   NOT NULL DEFAULT 'pt-BR',
  "max_discount"         DOUBLE PRECISION NOT NULL DEFAULT 10,
  "max_installments"     INTEGER       NOT NULL DEFAULT 3,
  "min_installment_value" DOUBLE PRECISION NOT NULL DEFAULT 50,
  "call_window_start"    VARCHAR(5)    NOT NULL DEFAULT '09:00',
  "call_window_end"      VARCHAR(5)    NOT NULL DEFAULT '18:00',
  "blocked_days"         TEXT[]        NOT NULL DEFAULT ARRAY['sunday'],
  "greeting"             TEXT,
  "transfer_phone"       VARCHAR(20),
  "twilio_phone_number"  VARCHAR(30),
  "persona"              JSONB         NOT NULL DEFAULT '{}',
  "scripts"              JSONB         NOT NULL DEFAULT '[]',
  "recovery_config"      JSONB,
  "created_at"           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  "updated_at"           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT "voice_agent_configs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "voice_agent_configs_tenant_id_key" UNIQUE ("tenant_id")
);

-- Add new columns if table already existed without them (idempotent for local/staging DBs)
ALTER TABLE "messaging_schema"."voice_agent_configs"
  ADD COLUMN IF NOT EXISTS "twilio_phone_number" VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "persona"             JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "scripts"             JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "recovery_config"     JSONB;
