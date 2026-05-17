-- Enable pgvector extension for vector similarity search
-- This is a no-op if the extension is not available on the RDS instance
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pgvector extension not available, skipping. Enable it manually after RDS reboot.';
END
$$;
