-- CreateSchema
CREATE SCHEMA IF NOT EXISTS billing_schema;

-- CreateTable: subscriptions (add columns that were added via runtime DDL)
ALTER TABLE billing_schema.subscriptions
  ADD COLUMN IF NOT EXISTS scheduled_plan VARCHAR(20),
  ADD COLUMN IF NOT EXISTS base_monthly_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS addons_monthly_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_monthly_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pricing_version VARCHAR(50),
  ADD COLUMN IF NOT EXISTS pricing_snapshot JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}';

-- CreateTable: billing_plan_catalog
CREATE TABLE IF NOT EXISTS billing_schema.billing_plan_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  monthly_price NUMERIC(12,2) NOT NULL,
  messages_quota INTEGER NOT NULL,
  ai_tokens_quota INTEGER NOT NULL,
  contacts_quota INTEGER NOT NULL,
  pricing_version VARCHAR(50),
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  features JSONB NOT NULL DEFAULT '[]',
  is_standard BOOLEAN NOT NULL DEFAULT FALSE,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CreateTable: billing_modules
CREATE TABLE IF NOT EXISTS billing_schema.billing_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  billing_mode VARCHAR(20) NOT NULL DEFAULT 'ADDON',
  monthly_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  pricing_version VARCHAR(50),
  sales_pitch TEXT,
  quota_impact JSONB NOT NULL DEFAULT '{}',
  included_in_plans JSONB NOT NULL DEFAULT '[]',
  config JSONB NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CreateTable: business_niches
CREATE TABLE IF NOT EXISTS billing_schema.business_niches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  pains JSONB NOT NULL DEFAULT '[]',
  icon_name VARCHAR(50),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CreateTable: niche_modules
CREATE TABLE IF NOT EXISTS billing_schema.niche_modules (
  niche_code VARCHAR(50) NOT NULL,
  module_code VARCHAR(50) NOT NULL,
  is_recommended BOOLEAN NOT NULL DEFAULT TRUE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  marketing_headline VARCHAR(255),
  sales_pitch TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (niche_code, module_code)
);

-- CreateTable: subscription_modules
CREATE TABLE IF NOT EXISTS billing_schema.subscription_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  module_code VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  monthly_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  pricing_version VARCHAR(50),
  pricing_snapshot JSONB NOT NULL DEFAULT '{}',
  quota_impact JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_subscription_modules_subscription_module UNIQUE (subscription_id, module_code)
);

-- CreateIndex: subscription_modules indexes
CREATE INDEX IF NOT EXISTS idx_subscription_modules_tenant_status
  ON billing_schema.subscription_modules (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_subscription_modules_module_code
  ON billing_schema.subscription_modules (module_code);

-- AlterTable: billing_plan_catalog (ensure pricing_version column exists)
ALTER TABLE billing_schema.billing_plan_catalog
  ADD COLUMN IF NOT EXISTS pricing_version VARCHAR(50);

-- AlterTable: billing_modules (ensure newer columns exist)
ALTER TABLE billing_schema.billing_modules
  ADD COLUMN IF NOT EXISTS category VARCHAR(50),
  ADD COLUMN IF NOT EXISTS billing_mode VARCHAR(20) NOT NULL DEFAULT 'ADDON',
  ADD COLUMN IF NOT EXISTS pricing_version VARCHAR(50),
  ADD COLUMN IF NOT EXISTS sales_pitch TEXT,
  ADD COLUMN IF NOT EXISTS quota_impact JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS included_in_plans JSONB NOT NULL DEFAULT '[]';

-- AlterTable: niche_modules (ensure newer columns exist)
ALTER TABLE billing_schema.niche_modules
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS marketing_headline VARCHAR(255),
  ADD COLUMN IF NOT EXISTS sales_pitch TEXT;
