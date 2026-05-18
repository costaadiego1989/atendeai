-- Add tracking code fields to commerce orders
ALTER TABLE commerce_schema.orders
  ADD COLUMN IF NOT EXISTS tracking_code VARCHAR(100),
  ADD COLUMN IF NOT EXISTS tracking_url TEXT,
  ADD COLUMN IF NOT EXISTS tracking_notified_at TIMESTAMPTZ;

-- Index for looking up orders by contact (used by "repeat last order" and "track order")
CREATE INDEX IF NOT EXISTS idx_orders_contact_id_created
  ON commerce_schema.orders (tenant_id, contact_id, created_at DESC)
  WHERE contact_id IS NOT NULL;
