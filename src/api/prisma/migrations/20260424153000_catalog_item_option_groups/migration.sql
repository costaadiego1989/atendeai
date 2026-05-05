ALTER TABLE catalog_schema.catalog_items
  ADD COLUMN IF NOT EXISTS option_groups JSONB NOT NULL DEFAULT '[]'::jsonb;
