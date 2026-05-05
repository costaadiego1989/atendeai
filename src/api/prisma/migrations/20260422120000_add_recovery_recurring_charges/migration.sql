CREATE TABLE IF NOT EXISTS recovery_schema.recovery_recurring_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  branch_id UUID NULL,
  case_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  billing_type VARCHAR(20) NOT NULL DEFAULT 'UNDEFINED',
  interval_days INTEGER NOT NULL,
  max_occurrences INTEGER NULL,
  occurrences_sent INTEGER NOT NULL DEFAULT 0,
  first_run_at TIMESTAMPTZ NOT NULL,
  next_run_at TIMESTAMPTZ NULL,
  last_run_at TIMESTAMPTZ NULL,
  message_template TEXT NULL,
  last_error TEXT NULL,
  lease_until TIMESTAMPTZ NULL,
  created_by_user_id UUID NULL,
  created_by_user_email VARCHAR(255) NULL,
  cancelled_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recovery_schema.recovery_recurring_charge_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurrence_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  case_id UUID NOT NULL,
  occurrence_number INTEGER NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PROCESSING',
  payment_link_id VARCHAR(120) NULL,
  conversation_id UUID NULL,
  message_id UUID NULL,
  error_message TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL,
  UNIQUE (recurrence_id, occurrence_number)
);

CREATE INDEX IF NOT EXISTS idx_recovery_recurring_charges_due
  ON recovery_schema.recovery_recurring_charges (status, next_run_at, lease_until);

CREATE INDEX IF NOT EXISTS idx_recovery_recurring_charges_case
  ON recovery_schema.recovery_recurring_charges (tenant_id, case_id);

CREATE INDEX IF NOT EXISTS idx_recovery_recurring_charge_runs_case
  ON recovery_schema.recovery_recurring_charge_runs (tenant_id, case_id, created_at DESC);
