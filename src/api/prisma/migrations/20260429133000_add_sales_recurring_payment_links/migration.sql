ALTER TABLE sales_schema.payment_links
  ADD COLUMN IF NOT EXISTS recurrence_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_frequency VARCHAR(20),
  ADD COLUMN IF NOT EXISTS recurrence_start_date DATE,
  ADD COLUMN IF NOT EXISTS recurrence_end_date DATE,
  ADD COLUMN IF NOT EXISTS recurrence_total_value NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS recurrence_next_run_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_sales_payment_links_recurring_due
  ON sales_schema.payment_links (tenant_id, recurrence_enabled, recurrence_next_run_at);
