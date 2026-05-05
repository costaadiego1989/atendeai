CREATE SCHEMA IF NOT EXISTS catalog_schema;

CREATE TABLE IF NOT EXISTS catalog_schema.catalog_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_categories_tenant_name
  ON catalog_schema.catalog_categories (tenant_id, name);

CREATE INDEX IF NOT EXISTS idx_catalog_categories_tenant_active
  ON catalog_schema.catalog_categories (tenant_id, active);

CREATE TABLE IF NOT EXISTS catalog_schema.catalog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  category_id UUID NULL,
  type VARCHAR(30) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  base_price NUMERIC(12, 2) NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'BRL',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  source VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
  external_reference VARCHAR(255) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_catalog_items_category
    FOREIGN KEY (category_id)
    REFERENCES catalog_schema.catalog_categories (id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_catalog_items_tenant_type_active
  ON catalog_schema.catalog_items (tenant_id, type, active);

CREATE INDEX IF NOT EXISTS idx_catalog_items_tenant_category
  ON catalog_schema.catalog_items (tenant_id, category_id);
