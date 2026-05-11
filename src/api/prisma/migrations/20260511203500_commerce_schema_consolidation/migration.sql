-- Commerce Schema Consolidation
-- Moves all runtime DDL from PrismaCommerceRepository.ensureInfrastructure() into a proper migration.
-- All statements are idempotent (IF NOT EXISTS) for safety on existing databases.

-- Schema
CREATE SCHEMA IF NOT EXISTS commerce_schema;

-- Shipping Policies
CREATE TABLE IF NOT EXISTS commerce_schema.shipping_policies (
  tenant_id UUID PRIMARY KEY,
  mode VARCHAR(20) NOT NULL,
  fixed_amount NUMERIC(12, 2),
  price_per_km NUMERIC(12, 2),
  minimum_amount NUMERIC(12, 2),
  max_radius_km NUMERIC(10, 2),
  serviced_neighborhoods JSONB,
  delivery_schedule JSONB,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE commerce_schema.shipping_policies
  ADD COLUMN IF NOT EXISTS max_radius_km NUMERIC(10, 2);

ALTER TABLE commerce_schema.shipping_policies
  ADD COLUMN IF NOT EXISTS serviced_neighborhoods JSONB;

ALTER TABLE commerce_schema.shipping_policies
  ADD COLUMN IF NOT EXISTS delivery_schedule JSONB;

-- Shopping Sessions
CREATE TABLE IF NOT EXISTS commerce_schema.shopping_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  branch_id UUID,
  conversation_id UUID NOT NULL,
  contact_id UUID,
  status VARCHAR(30) NOT NULL DEFAULT 'BUILDING_CART',
  fulfillment_type VARCHAR(20),
  shipping_mode VARCHAR(20),
  distance_km NUMERIC(10, 2),
  freight_amount NUMERIC(12, 2),
  subtotal_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  delivery_address TEXT,
  notes TEXT,
  payment_reference VARCHAR(255),
  payment_link_id VARCHAR(80),
  payment_link_url TEXT,
  payment_status VARCHAR(20),
  checked_out_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE commerce_schema.shopping_sessions
  ADD COLUMN IF NOT EXISTS current_step VARCHAR(40) NOT NULL DEFAULT 'IDENTIFYING_NEED';

ALTER TABLE commerce_schema.shopping_sessions
  ADD COLUMN IF NOT EXISTS pending_query TEXT;

ALTER TABLE commerce_schema.shopping_sessions
  ADD COLUMN IF NOT EXISTS pending_options JSONB;

ALTER TABLE commerce_schema.shopping_sessions
  ADD COLUMN IF NOT EXISTS selected_source VARCHAR(20);

ALTER TABLE commerce_schema.shopping_sessions
  ADD COLUMN IF NOT EXISTS selected_inventory_item_id UUID;

ALTER TABLE commerce_schema.shopping_sessions
  ADD COLUMN IF NOT EXISTS selected_catalog_item_id UUID;

ALTER TABLE commerce_schema.shopping_sessions
  ADD COLUMN IF NOT EXISTS selected_item_name VARCHAR(255);

ALTER TABLE commerce_schema.shopping_sessions
  ADD COLUMN IF NOT EXISTS abandonment_paused BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE commerce_schema.shopping_sessions
  ADD COLUMN IF NOT EXISTS branch_id UUID;

ALTER TABLE commerce_schema.shopping_sessions
  ADD COLUMN IF NOT EXISTS abandonment_paused_at TIMESTAMPTZ;

ALTER TABLE commerce_schema.shopping_sessions
  ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(100);

ALTER TABLE commerce_schema.shopping_sessions
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2);

-- Shopping Session Items
CREATE TABLE IF NOT EXISTS commerce_schema.shopping_session_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES commerce_schema.shopping_sessions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  source VARCHAR(20) NOT NULL,
  inventory_item_id UUID,
  catalog_item_id UUID,
  name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL,
  unit_price NUMERIC(12, 2),
  currency VARCHAR(10) NOT NULL DEFAULT 'BRL',
  line_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Orders
CREATE TABLE IF NOT EXISTS commerce_schema.orders (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  branch_id UUID,
  session_id UUID NOT NULL UNIQUE REFERENCES commerce_schema.shopping_sessions(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  contact_id UUID,
  status VARCHAR(30) NOT NULL,
  fulfillment_type VARCHAR(20),
  shipping_mode VARCHAR(20),
  subtotal_amount NUMERIC(12, 2) NOT NULL,
  freight_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12, 2) NOT NULL,
  delivery_address TEXT,
  payment_reference VARCHAR(255) UNIQUE,
  payment_link_id VARCHAR(80),
  payment_link_url TEXT,
  payment_status VARCHAR(20),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE commerce_schema.orders
  ADD COLUMN IF NOT EXISTS branch_id UUID;

ALTER TABLE commerce_schema.orders
  ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(100);

ALTER TABLE commerce_schema.orders
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2);

-- Commerce Audit Log
CREATE TABLE IF NOT EXISTS commerce_schema.commerce_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID,
  user_name TEXT,
  event VARCHAR(100) NOT NULL,
  entity_id UUID NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Commerce Abandonment Configs
CREATE TABLE IF NOT EXISTS commerce_schema.commerce_abandonment_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  message TEXT,
  use_ai_message BOOLEAN NOT NULL DEFAULT FALSE,
  mode VARCHAR(20) NOT NULL DEFAULT 'SINGLE',
  max_touches INT NOT NULL DEFAULT 3,
  interval_minutes INT NOT NULL DEFAULT 60,
  minimum_interval_minutes INT NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_commerce_sessions_tenant_conversation
  ON commerce_schema.shopping_sessions (tenant_id, conversation_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_commerce_orders_tenant_reference
  ON commerce_schema.orders (tenant_id, payment_reference);

CREATE INDEX IF NOT EXISTS idx_commerce_orders_tenant_branch_status
  ON commerce_schema.orders (tenant_id, branch_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_commerce_sessions_tenant_branch_status
  ON commerce_schema.shopping_sessions (tenant_id, branch_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_commerce_audit_log_entity
  ON commerce_schema.commerce_audit_log (entity_id, entity_type, event);

CREATE INDEX IF NOT EXISTS idx_commerce_abandonment_configs_tenant
  ON commerce_schema.commerce_abandonment_configs (tenant_id);
