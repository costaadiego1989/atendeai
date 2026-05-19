-- Add columns that were supposed to be added by recovery_schema_consolidation
-- but failed to land in the actual DB table.

ALTER TABLE recovery_schema.recovery_cases
  ADD COLUMN IF NOT EXISTS branch_id UUID NULL;

ALTER TABLE recovery_schema.recovery_cases
  ADD COLUMN IF NOT EXISTS playbook_id UUID NULL;

ALTER TABLE recovery_schema.recovery_cases
  ADD COLUMN IF NOT EXISTS playbook_phase_index INTEGER NOT NULL DEFAULT 0;

ALTER TABLE recovery_schema.recovery_cases
  ADD COLUMN IF NOT EXISTS last_playbook_phase_executed_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_recovery_cases_tenant_branch
  ON recovery_schema.recovery_cases (tenant_id, branch_id);
