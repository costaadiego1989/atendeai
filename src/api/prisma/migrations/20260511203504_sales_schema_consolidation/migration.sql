-- Consolidate remaining runtime DDL columns into a proper migration.
-- Columns already added by prior migrations are guarded with IF NOT EXISTS for idempotency.

-- 1. Ensure external_id type is wide enough (idempotent: re-casting to same type is a no-op in PG)
ALTER TABLE sales_schema.payment_links
  ALTER COLUMN external_id TYPE VARCHAR(120);

-- 2. Add all columns that were previously managed at runtime.
--    Using IF NOT EXISTS so this migration is safe to re-run or apply on databases
--    where the runtime DDL already executed.
ALTER TABLE sales_schema.payment_links
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS label VARCHAR(120),
  ADD COLUMN IF NOT EXISTS provider_link_id VARCHAR(80),
  ADD COLUMN IF NOT EXISTS billing_type VARCHAR(20) NOT NULL DEFAULT 'PIX',
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS resource_type VARCHAR(20) NOT NULL DEFAULT 'PAYMENT_LINK',
  ADD COLUMN IF NOT EXISTS branch_id UUID,
  ADD COLUMN IF NOT EXISTS contact_id UUID,
  ADD COLUMN IF NOT EXISTS conversation_id UUID,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recurrence_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_frequency VARCHAR(20),
  ADD COLUMN IF NOT EXISTS recurrence_start_date DATE,
  ADD COLUMN IF NOT EXISTS recurrence_end_date DATE,
  ADD COLUMN IF NOT EXISTS recurrence_total_value NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS recurrence_next_run_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS catalog_item_id UUID,
  ADD COLUMN IF NOT EXISTS catalog_item_sku VARCHAR(80),
  ADD COLUMN IF NOT EXISTS catalog_item_name VARCHAR(255);
