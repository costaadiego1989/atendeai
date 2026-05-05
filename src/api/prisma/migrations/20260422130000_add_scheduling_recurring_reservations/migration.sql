CREATE SCHEMA IF NOT EXISTS scheduling_schema;

CREATE TABLE IF NOT EXISTS scheduling_schema.scheduling_recurring_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  branch_id UUID NULL,
  professional_id VARCHAR(80) NOT NULL,
  contact_id UUID NULL,
  category_id VARCHAR(80) NULL,
  conversation_id UUID NULL,
  period VARCHAR(20) NOT NULL,
  max_occurrences INTEGER NOT NULL,
  occurrences_created INTEGER NOT NULL DEFAULT 1,
  starts_at VARCHAR(5) NOT NULL,
  ends_at VARCHAR(5) NOT NULL,
  first_date DATE NOT NULL,
  next_date DATE NULL,
  next_run_at TIMESTAMPTZ NULL,
  is_free BOOLEAN NOT NULL DEFAULT TRUE,
  is_online BOOLEAN NOT NULL DEFAULT FALSE,
  payment_timeout_hours INTEGER NULL,
  notes TEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  last_error TEXT NULL,
  lease_until TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL,
  cancelled_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS scheduling_schema.scheduling_recurring_reservation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurrence_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  occurrence_number INTEGER NOT NULL,
  target_date DATE NOT NULL,
  slot_id VARCHAR(80) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PROCESSING',
  error_message TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL,
  UNIQUE (recurrence_id, occurrence_number)
);

CREATE INDEX IF NOT EXISTS idx_scheduling_recurring_reservations_due
  ON scheduling_schema.scheduling_recurring_reservations (status, next_run_at, lease_until);

CREATE INDEX IF NOT EXISTS idx_scheduling_recurring_reservations_tenant_professional
  ON scheduling_schema.scheduling_recurring_reservations (tenant_id, professional_id, status);
