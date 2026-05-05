ALTER TABLE recovery_schema.recovery_cases
ADD COLUMN IF NOT EXISTS suggested_reply TEXT,
ADD COLUMN IF NOT EXISTS suggested_next_action TEXT,
ADD COLUMN IF NOT EXISTS guidance_generated_at TIMESTAMPTZ;
