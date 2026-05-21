ALTER TABLE "messaging_schema"."voice_agent_configs"
  ADD COLUMN IF NOT EXISTS "twilio_phone_number" VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "persona" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "scripts" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "recovery_config" JSONB;
