-- Add collect_email and collect_cpf to widget_configs
ALTER TABLE "messaging_schema"."widget_configs"
  ADD COLUMN IF NOT EXISTS "collect_email" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "messaging_schema"."widget_configs"
  ADD COLUMN IF NOT EXISTS "collect_cpf" BOOLEAN NOT NULL DEFAULT false;

-- Add visitor_cpf to widget_sessions
ALTER TABLE "messaging_schema"."widget_sessions"
  ADD COLUMN IF NOT EXISTS "visitor_cpf" VARCHAR(14);
