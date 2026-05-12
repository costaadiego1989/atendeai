-- Migration: consolidate_runtime_ddl
-- Moves all runtime DDL into a proper Prisma migration.
-- All statements use IF NOT EXISTS / IF EXISTS to be idempotent.

-- =============================================================================
-- SCHEMAS
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS support_schema;

-- =============================================================================
-- TENANT MODULE
-- =============================================================================

-- Add missing columns to tenants
ALTER TABLE tenant_schema.tenants
  ADD COLUMN IF NOT EXISTS street_number VARCHAR(30),
  ADD COLUMN IF NOT EXISTS owner_user_id UUID;

-- tenant_branches table
CREATE TABLE IF NOT EXISTS tenant_schema.tenant_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  whatsapp_number VARCHAR(30),
  instagram_account_id VARCHAR(255),
  whatsapp_provider VARCHAR(30),
  whatsapp_credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
  whatsapp_webhook_secret TEXT,
  cnpj VARCHAR(20),
  zipcode VARCHAR(20),
  street VARCHAR(255),
  street_number VARCHAR(30),
  neighborhood VARCHAR(255),
  city VARCHAR(120),
  state VARCHAR(10),
  operating_hours JSONB,
  is_headquarters BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_branches_tenant_id_fkey FOREIGN KEY (tenant_id)
    REFERENCES tenant_schema.tenants(id) ON DELETE CASCADE
);

-- tenant_twilio_accounts table
CREATE TABLE IF NOT EXISTS tenant_schema.tenant_twilio_accounts (
  tenant_id UUID PRIMARY KEY,
  account_sid VARCHAR(34) NOT NULL UNIQUE,
  auth_token TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  friendly_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_twilio_accounts_tenant_id_fkey FOREIGN KEY (tenant_id)
    REFERENCES tenant_schema.tenants(id) ON DELETE CASCADE
);

-- tenant_audit_logs table
CREATE TABLE IF NOT EXISTS tenant_schema.tenant_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NULL,
  email VARCHAR(255) NULL,
  event_type VARCHAR(80) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tenant_audit_logs_tenant_created
  ON tenant_schema.tenant_audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_audit_logs_event_created
  ON tenant_schema.tenant_audit_logs(event_type, created_at DESC);

-- =============================================================================
-- AUTH MODULE
-- =============================================================================
CREATE TABLE IF NOT EXISTS shared_schema.auth_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NULL,
  email VARCHAR(255) NULL,
  event_type VARCHAR(80) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  device_id VARCHAR(255),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_user
  ON shared_schema.auth_audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_tenant
  ON shared_schema.auth_audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_event
  ON shared_schema.auth_audit_logs(event_type, created_at DESC);

-- =============================================================================
-- MESSAGING MODULE
-- =============================================================================

-- Add columns to conversations
ALTER TABLE messaging_schema.conversations
  ADD COLUMN IF NOT EXISTS branch_id UUID,
  ADD COLUMN IF NOT EXISTS assigned_user_id UUID,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unread_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_inbound_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_outbound_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_message_direction VARCHAR(10),
  ADD COLUMN IF NOT EXISTS last_message_preview TEXT,
  ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_read_sort_order BIGINT;

CREATE INDEX IF NOT EXISTS idx_conversations_tenant_branch_status
  ON messaging_schema.conversations(tenant_id, branch_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_assigned
  ON messaging_schema.conversations(tenant_id, assigned_user_id);

-- Add sort_order to messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_sequences WHERE schemaname = 'messaging_schema' AND sequencename = 'messages_sort_order_seq'
  ) THEN
    CREATE SEQUENCE messaging_schema.messages_sort_order_seq;
  END IF;
END $$;

ALTER TABLE messaging_schema.messages
  ADD COLUMN IF NOT EXISTS sort_order BIGINT;

-- Set default for sort_order
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'messaging_schema' AND table_name = 'messages' AND column_name = 'sort_order'
      AND column_default IS NULL
  ) THEN
    ALTER TABLE messaging_schema.messages
      ALTER COLUMN sort_order SET DEFAULT nextval('messaging_schema.messages_sort_order_seq');
  END IF;
END $$;

-- conversation_intelligence table
CREATE TABLE IF NOT EXISTS messaging_schema.conversation_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  sentiment VARCHAR(20),
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  interests JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_conversation_intelligence_tenant_sentiment
  ON messaging_schema.conversation_intelligence(tenant_id, sentiment);

-- =============================================================================
-- CATALOG MODULE
-- =============================================================================
CREATE TABLE IF NOT EXISTS catalog_schema.catalog_async_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  job_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB,
  error TEXT,
  progress INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_catalog_async_jobs_tenant_status
  ON catalog_schema.catalog_async_jobs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_catalog_async_jobs_type_status
  ON catalog_schema.catalog_async_jobs(job_type, status);

-- =============================================================================
-- PROSPECTING MODULE
-- =============================================================================
CREATE TABLE IF NOT EXISTS prospecting_schema.prospecting_async_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  job_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB,
  error TEXT,
  progress INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prospecting_async_jobs_tenant_status
  ON prospecting_schema.prospecting_async_jobs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_prospecting_async_jobs_type_status
  ON prospecting_schema.prospecting_async_jobs(job_type, status);

CREATE TABLE IF NOT EXISTS prospecting_schema.google_ads_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE,
  refresh_token TEXT NOT NULL,
  customer_id VARCHAR(64) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- SCHEDULING MODULE
-- =============================================================================
CREATE TABLE IF NOT EXISTS scheduling_schema.scheduling_async_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  job_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB,
  error TEXT,
  progress INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scheduling_async_jobs_tenant_status
  ON scheduling_schema.scheduling_async_jobs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_scheduling_async_jobs_type_status
  ON scheduling_schema.scheduling_async_jobs(job_type, status);

CREATE TABLE IF NOT EXISTS scheduling_schema.google_calendar_connection_scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  branch_id UUID,
  user_id UUID NOT NULL,
  refresh_token TEXT NOT NULL,
  access_token TEXT,
  token_expires_at TIMESTAMPTZ,
  calendar_id VARCHAR(255),
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_google_calendar_scopes_tenant_branch
  ON scheduling_schema.google_calendar_connection_scopes(tenant_id, branch_id);

CREATE TABLE IF NOT EXISTS scheduling_schema.google_calendar_event_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  branch_id UUID,
  slot_id VARCHAR(80) NOT NULL,
  google_event_id VARCHAR(255) NOT NULL,
  calendar_id VARCHAR(255) NOT NULL,
  sync_status VARCHAR(20) NOT NULL DEFAULT 'SYNCED',
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_google_calendar_event_links_tenant_branch
  ON scheduling_schema.google_calendar_event_links(tenant_id, branch_id);

-- =============================================================================
-- SUPPORT MODULE
-- =============================================================================
CREATE TABLE IF NOT EXISTS support_schema.feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID,
  branch_id UUID,
  app_module VARCHAR(80),
  type VARCHAR(30) NOT NULL DEFAULT 'FEEDBACK',
  subject VARCHAR(255),
  message TEXT NOT NULL,
  rating INT,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_feedbacks_tenant_status
  ON support_schema.feedbacks(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_feedbacks_app_module
  ON support_schema.feedbacks(app_module);

-- =============================================================================
-- AGENT-RULES MODULE
-- =============================================================================
ALTER TABLE tenant_schema.tenant_agent_rules
  ADD COLUMN IF NOT EXISTS branch_id UUID;

ALTER TABLE tenant_schema.tenant_agent_rule_history
  ADD COLUMN IF NOT EXISTS branch_id UUID;

-- =============================================================================
-- PAYMENT MODULE - add updated_at to payment_links if missing
-- =============================================================================
-- (already exists in schema as updated_at, this is a safety net)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'sales_schema' AND table_name = 'payment_links' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE sales_schema.payment_links ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;
