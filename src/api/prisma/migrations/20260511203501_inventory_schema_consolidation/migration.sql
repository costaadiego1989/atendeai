-- Ensure the inventory schema exists
CREATE SCHEMA IF NOT EXISTS inventory_schema;

-- Create the inventory_async_jobs table (previously managed at runtime via ensureTableShape)
CREATE TABLE IF NOT EXISTS inventory_schema.inventory_async_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  type VARCHAR(50) NOT NULL,
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

-- Index for listing jobs by tenant ordered by creation date
CREATE INDEX IF NOT EXISTS idx_inventory_async_jobs_tenant_created
  ON inventory_schema.inventory_async_jobs (tenant_id, created_at DESC);
