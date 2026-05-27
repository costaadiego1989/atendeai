-- Add carrier shipping support: weight/dimensions on catalog and inventory items,
-- carrier_shipping_enabled on shipping policies, carrier fields on shopping sessions,
-- and carrier_service_name on orders.

-- 1. Catalog items: weight and dimensions for freight calculation
ALTER TABLE catalog_schema.catalog_items
  ADD COLUMN IF NOT EXISTS weight_grams INTEGER,
  ADD COLUMN IF NOT EXISTS height_cm INTEGER,
  ADD COLUMN IF NOT EXISTS width_cm INTEGER,
  ADD COLUMN IF NOT EXISTS length_cm INTEGER;

-- 2. Inventory items: weight and dimensions (may override catalog)
ALTER TABLE inventory_schema.inventory_items
  ADD COLUMN IF NOT EXISTS weight_grams INTEGER,
  ADD COLUMN IF NOT EXISTS height_cm INTEGER,
  ADD COLUMN IF NOT EXISTS width_cm INTEGER,
  ADD COLUMN IF NOT EXISTS length_cm INTEGER;

-- 3. Shipping policies: flag to enable carrier shipping
ALTER TABLE commerce_schema.shipping_policies
  ADD COLUMN IF NOT EXISTS carrier_shipping_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- 4. Shopping sessions: carrier shipping fields
ALTER TABLE commerce_schema.shopping_sessions
  ADD COLUMN IF NOT EXISTS carrier_cep VARCHAR(9),
  ADD COLUMN IF NOT EXISTS carrier_service_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS carrier_service_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS carrier_delivery_days INTEGER;

-- 5. Orders: carrier service name for reference
ALTER TABLE commerce_schema.orders
  ADD COLUMN IF NOT EXISTS carrier_service_name VARCHAR(100);
