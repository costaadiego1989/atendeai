-- Create users table (was previously managed by runtime DDL)
CREATE TABLE IF NOT EXISTS tenant_schema.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(20) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  role VARCHAR(20) NOT NULL DEFAULT 'AGENT',
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_tenant_id_fkey FOREIGN KEY (tenant_id)
    REFERENCES tenant_schema.tenants(id) ON DELETE CASCADE
);
