CREATE SCHEMA IF NOT EXISTS inventory_schema;

CREATE TABLE IF NOT EXISTS inventory_schema.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  catalog_item_id UUID NULL,
  sku VARCHAR(100) NOT NULL,
  external_reference VARCHAR(255) NULL,
  name VARCHAR(255) NOT NULL,
  available_quantity INT NOT NULL DEFAULT 0,
  availability_status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE',
  current_price NUMERIC(12, 2) NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'BRL',
  source VARCHAR(30) NOT NULL DEFAULT 'MANUAL_SNAPSHOT',
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_inventory_items_tenant_sku UNIQUE (tenant_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_tenant_status
  ON inventory_schema.inventory_items (tenant_id, availability_status);

CREATE INDEX IF NOT EXISTS idx_inventory_items_tenant_catalog
  ON inventory_schema.inventory_items (tenant_id, catalog_item_id);
