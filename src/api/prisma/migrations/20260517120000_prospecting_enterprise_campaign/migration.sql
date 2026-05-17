-- Migration: prospecting_enterprise_campaign
-- Adds template + anti-abuse fields to ProspectCampaign
-- Adds prospectingOptOut to Contact
-- Adds index for contact-scoped execution queries

-- Contact: opt-out tracking
ALTER TABLE contact_schema.contacts
  ADD COLUMN IF NOT EXISTS "prospecting_opt_out"    BOOLEAN   NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "prospecting_opt_out_at" TIMESTAMPTZ;

-- ProspectCampaign: template + anti-abuse config
ALTER TABLE prospecting_schema.prospect_campaigns
  ADD COLUMN IF NOT EXISTS "template_name"             VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "language_code"             VARCHAR(10)  NOT NULL DEFAULT 'pt_BR',
  ADD COLUMN IF NOT EXISTS "template_variable_mapping" JSONB,
  ADD COLUMN IF NOT EXISTS "ai_variable_generation"    BOOLEAN      NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "cooldown_days"             INTEGER      NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "min_delay_seconds"         INTEGER      NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "max_delay_seconds"         INTEGER      NOT NULL DEFAULT 120,
  ADD COLUMN IF NOT EXISTS "block_rate_threshold"      FLOAT8       NOT NULL DEFAULT 0.05;

-- ProspectExecution: index for contact-scoped lookups (cooldown check + badge query)
CREATE INDEX IF NOT EXISTS "idx_prospect_executions_tenant_contact_status"
  ON prospecting_schema.prospect_executions ("tenant_id", "contact_id", "status");
