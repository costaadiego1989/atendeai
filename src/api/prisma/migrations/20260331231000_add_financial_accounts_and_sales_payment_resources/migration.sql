CREATE TABLE IF NOT EXISTS tenant_schema.tenant_financial_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenant_schema.tenants(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL DEFAULT 'ASAAS',
  asaas_account_id VARCHAR(80) NOT NULL,
  wallet_id VARCHAR(80) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contact_schema.contact_financial_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant_schema.tenants(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contact_schema.contacts(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL DEFAULT 'ASAAS',
  asaas_customer_id VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_contact_financial_profiles_tenant_contact UNIQUE (tenant_id, contact_id)
);

ALTER TABLE sales_schema.payment_links
  ADD COLUMN IF NOT EXISTS resource_type VARCHAR(20) NOT NULL DEFAULT 'PAYMENT_LINK',
  ADD COLUMN IF NOT EXISTS contact_id UUID,
  ADD COLUMN IF NOT EXISTS conversation_id UUID;
