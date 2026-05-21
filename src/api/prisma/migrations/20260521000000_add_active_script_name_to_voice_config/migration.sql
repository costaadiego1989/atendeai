ALTER TABLE "messaging_schema"."voice_agent_configs"
  ADD COLUMN IF NOT EXISTS "active_script_name" VARCHAR(255);
