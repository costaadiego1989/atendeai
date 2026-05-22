-- Create widget_sessions table.
-- Safe to re-run: uses CREATE TABLE IF NOT EXISTS.
-- This table was missing a CREATE TABLE migration — only ALTER TABLE existed,
-- so production deployments never created the table.
CREATE TABLE IF NOT EXISTS "messaging_schema"."widget_sessions" (
  "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
  "widget_config_id" UUID         NOT NULL,
  "tenant_id"        UUID         NOT NULL,
  "contact_id"       UUID,
  "conversation_id"  UUID,
  "visitor_id"       VARCHAR(100) NOT NULL,
  "visitor_name"     VARCHAR(255),
  "visitor_phone"    VARCHAR(20),
  "visitor_email"    VARCHAR(255),
  "visitor_cpf"      VARCHAR(14),
  "page_url"         TEXT,
  "status"           VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
  "last_active_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "created_at"       TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "widget_sessions_pkey" PRIMARY KEY ("id")
);

-- Foreign key to widget_configs
DO $$ BEGIN
  ALTER TABLE "messaging_schema"."widget_sessions"
    ADD CONSTRAINT "widget_sessions_widget_config_id_fkey"
    FOREIGN KEY ("widget_config_id")
    REFERENCES "messaging_schema"."widget_configs" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes for fast visitor-based lookup and session management
CREATE INDEX IF NOT EXISTS "idx_widget_sessions_tenant_visitor"
  ON "messaging_schema"."widget_sessions" ("tenant_id", "visitor_id");

CREATE INDEX IF NOT EXISTS "idx_widget_sessions_config_status"
  ON "messaging_schema"."widget_sessions" ("widget_config_id", "status");
