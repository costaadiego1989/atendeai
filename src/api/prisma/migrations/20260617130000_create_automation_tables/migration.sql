-- Migration: create_automation_tables
-- The Automation / AutomationStep / AutomationExecution models existed in
-- schema.prisma but no migration ever created their tables, so `prisma migrate
-- deploy` (prod) never provisioned them. Creating an automation failed with a
-- generic DATABASE_ERROR ("relation automations does not exist").
-- Idempotent (IF NOT EXISTS) so it is safe in any environment that already has
-- the tables from a prior `db push`.

-- Automation
CREATE TABLE IF NOT EXISTS tenant_schema.automations (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"   UUID         NOT NULL,
  "name"        VARCHAR(255) NOT NULL,
  "description" TEXT,
  "is_active"   BOOLEAN      NOT NULL DEFAULT FALSE,
  "trigger"     JSONB        NOT NULL,
  "conditions"  JSONB        DEFAULT '[]',
  "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT "automations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_automations_tenant_active"
  ON tenant_schema.automations ("tenant_id", "is_active");

-- AutomationStep
CREATE TABLE IF NOT EXISTS tenant_schema.automation_steps (
  "id"            UUID        NOT NULL DEFAULT gen_random_uuid(),
  "automation_id" UUID        NOT NULL,
  "order"         INTEGER     NOT NULL DEFAULT 0,
  "type"          VARCHAR(50) NOT NULL,
  "config"        JSONB       NOT NULL,
  "next_step_id"  UUID,
  CONSTRAINT "automation_steps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_automation_steps_order"
  ON tenant_schema.automation_steps ("automation_id", "order");

-- AutomationExecution
CREATE TABLE IF NOT EXISTS tenant_schema.automation_executions (
  "id"            UUID        NOT NULL DEFAULT gen_random_uuid(),
  "automation_id" UUID        NOT NULL,
  "tenant_id"     UUID        NOT NULL,
  "contact_id"    UUID,
  "status"        VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
  "current_step"  INTEGER     NOT NULL DEFAULT 0,
  "context"       JSONB       DEFAULT '{}',
  "started_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completed_at"  TIMESTAMPTZ,
  "error"         TEXT,
  CONSTRAINT "automation_executions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_automation_executions_tenant_status"
  ON tenant_schema.automation_executions ("tenant_id", "status");

CREATE INDEX IF NOT EXISTS "idx_automation_executions_automation_status"
  ON tenant_schema.automation_executions ("automation_id", "status");

-- Foreign keys (added after tables exist; guarded so re-runs do not error)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'automation_steps_automation_id_fkey'
  ) THEN
    ALTER TABLE tenant_schema.automation_steps
      ADD CONSTRAINT "automation_steps_automation_id_fkey"
      FOREIGN KEY ("automation_id")
      REFERENCES tenant_schema.automations ("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'automation_executions_automation_id_fkey'
  ) THEN
    ALTER TABLE tenant_schema.automation_executions
      ADD CONSTRAINT "automation_executions_automation_id_fkey"
      FOREIGN KEY ("automation_id")
      REFERENCES tenant_schema.automations ("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
