-- Manual sale attribution + commission/profile tables (ATT-SALES / COMM-*)

CREATE TABLE IF NOT EXISTS tenant_schema.tenant_sales_commission_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenant_schema.tenants(id) ON DELETE CASCADE,
  base_percent DECIMAL(9, 4),
  base_fixed_amount DECIMAL(12, 2),
  commission_combine_mode VARCHAR(20) NOT NULL DEFAULT 'STACKED',
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_schema.tenant_user_sales_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant_schema.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL UNIQUE REFERENCES tenant_schema.users(id) ON DELETE CASCADE,
  commission_percent_override DECIMAL(9, 4),
  commission_fixed_override DECIMAL(12, 2),
  monthly_sales_count_target INTEGER,
  monthly_sales_amount_target DECIMAL(12, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tenant_user_sales_profile UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tusp_tenant ON tenant_schema.tenant_user_sales_profiles(tenant_id);

CREATE TABLE IF NOT EXISTS sales_schema.conversation_sale_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant_schema.tenants(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES messaging_schema.conversations(id) ON DELETE CASCADE,
  attributed_user_id UUID NOT NULL REFERENCES tenant_schema.users(id) ON DELETE CASCADE,
  sale_amount DECIMAL(12, 2),
  currency VARCHAR(10),
  lifecycle_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  ai_validation_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  marked_by_user_id UUID NOT NULL REFERENCES tenant_schema.users(id) ON DELETE CASCADE,
  marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ai_validated_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cse_tenant_attr_marked ON sales_schema.conversation_sale_events(tenant_id, attributed_user_id, marked_at);
CREATE INDEX IF NOT EXISTS idx_cse_tenant_conversation ON sales_schema.conversation_sale_events(tenant_id, conversation_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_conversation_sale_active_approved
  ON sales_schema.conversation_sale_events (tenant_id, conversation_id)
  WHERE lifecycle_status = 'ACTIVE' AND ai_validation_status = 'APPROVED';
