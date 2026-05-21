-- Ensure all collect columns exist on widget_configs.
-- Safe to re-run: uses ADD COLUMN IF NOT EXISTS.
-- Root cause: original migration used CREATE TABLE IF NOT EXISTS, which skipped
-- collect_name/collect_phone for pre-existing tables.
ALTER TABLE "messaging_schema"."widget_configs"
  ADD COLUMN IF NOT EXISTS "collect_name"  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "collect_phone" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "collect_email" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "collect_cpf"   BOOLEAN NOT NULL DEFAULT false;
