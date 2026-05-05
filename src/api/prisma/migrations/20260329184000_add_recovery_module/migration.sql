CREATE SCHEMA IF NOT EXISTS recovery_schema;

CREATE TABLE IF NOT EXISTS recovery_schema.recovery_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  contact_id UUID NULL,
  debtor_name VARCHAR(255) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  external_reference VARCHAR(255) NULL,
  source VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
  amount_due NUMERIC(12, 2) NULL,
  due_date DATE NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'READY_TO_CONTACT',
  assigned_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_contacted_at TIMESTAMPTZ NULL,
  next_action_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recovery_cases_tenant_status
  ON recovery_schema.recovery_cases (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_recovery_cases_tenant_source
  ON recovery_schema.recovery_cases (tenant_id, source);
