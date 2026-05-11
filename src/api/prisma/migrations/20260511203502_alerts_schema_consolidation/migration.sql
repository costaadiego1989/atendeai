-- CreateSchema
CREATE SCHEMA IF NOT EXISTS alerts_schema;

-- CreateTable
CREATE TABLE IF NOT EXISTS alerts_schema.alert_reminders (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  branch_id UUID,
  user_id UUID NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  user_phone VARCHAR(40) NOT NULL,
  user_email VARCHAR(255),
  timezone VARCHAR(80),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  frequency VARCHAR(20) NOT NULL,
  scheduled_at TIMESTAMPTZ,
  time_of_day VARCHAR(5),
  next_trigger_at TIMESTAMPTZ,
  last_triggered_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS idx_alert_reminders_tenant_branch
ON alerts_schema.alert_reminders (tenant_id, branch_id);
