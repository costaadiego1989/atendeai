-- Contact schema consolidation: moves runtime DDL into a proper migration

-- 1. Add columns to contacts table that were previously added at runtime
ALTER TABLE contact_schema.contacts
ADD COLUMN IF NOT EXISTS document VARCHAR(30);

ALTER TABLE contact_schema.contacts
ADD COLUMN IF NOT EXISTS branch_id UUID;

CREATE INDEX IF NOT EXISTS idx_contacts_tenant_branch_stage
ON contact_schema.contacts (tenant_id, branch_id, stage);

-- 2. Create contact_async_jobs table (previously created at runtime)
CREATE TABLE IF NOT EXISTS contact_schema.contact_async_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  branch_id UUID NULL,
  type VARCHAR(40) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
  requested_by_user_id UUID NULL,
  requested_by_user_email VARCHAR(255) NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  progress INTEGER NOT NULL DEFAULT 0,
  total_items INTEGER NOT NULL DEFAULT 0,
  processed_items INTEGER NOT NULL DEFAULT 0,
  result_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  file_name VARCHAR(255) NULL,
  file_mime_type VARCHAR(120) NULL,
  file_url TEXT NULL,
  file_content TEXT NULL,
  error_message TEXT NULL,
  queue_job_id VARCHAR(120) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL,
  failed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_contact_async_jobs_tenant_created
ON contact_schema.contact_async_jobs (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_async_jobs_tenant_status
ON contact_schema.contact_async_jobs (tenant_id, status);
