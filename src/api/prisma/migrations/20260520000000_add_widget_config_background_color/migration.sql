-- Create widget_configs table if it doesn't exist yet
-- (model was added to schema without a prior migration)
CREATE TABLE IF NOT EXISTS "messaging_schema"."widget_configs" (
  "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"        UUID         NOT NULL,
  "enabled"          BOOLEAN      NOT NULL DEFAULT true,
  "public_token"     UUID         NOT NULL DEFAULT gen_random_uuid(),
  "name"             VARCHAR(100) NOT NULL DEFAULT 'Chat',
  "greeting"         TEXT,
  "color"            VARCHAR(20)  NOT NULL DEFAULT '#00C59E',
  "background_color" VARCHAR(20),
  "position"         VARCHAR(20)  NOT NULL DEFAULT 'bottom-right',
  "avatar_url"       TEXT,
  "collect_name"     BOOLEAN      NOT NULL DEFAULT true,
  "collect_phone"    BOOLEAN      NOT NULL DEFAULT true,
  "proactive_delay"  INTEGER,
  "proactive_msg"    TEXT,
  "allowed_origins"  JSONB        NOT NULL DEFAULT '[]',
  "created_at"       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"       TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "widget_configs_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on public_token
DO $$ BEGIN
  ALTER TABLE "messaging_schema"."widget_configs"
    ADD CONSTRAINT "widget_configs_public_token_key" UNIQUE ("public_token");
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;

-- Add background_color if table already existed without the column
ALTER TABLE "messaging_schema"."widget_configs"
  ADD COLUMN IF NOT EXISTS "background_color" VARCHAR(20);

-- Index on tenant_id
CREATE INDEX IF NOT EXISTS "idx_widget_configs_tenant"
  ON "messaging_schema"."widget_configs" ("tenant_id");
