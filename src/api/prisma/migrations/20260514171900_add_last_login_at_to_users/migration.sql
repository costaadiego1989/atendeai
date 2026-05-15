-- AlterTable
ALTER TABLE tenant_schema.users
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
