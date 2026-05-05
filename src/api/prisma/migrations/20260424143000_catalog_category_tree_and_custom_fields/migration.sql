ALTER TABLE catalog_schema.catalog_categories
  ADD COLUMN IF NOT EXISTS parent_category_id UUID NULL,
  ADD COLUMN IF NOT EXISTS path TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 0;

UPDATE catalog_schema.catalog_categories
SET path = ARRAY[name]::TEXT[]
WHERE path IS NULL OR cardinality(path) = 0;

ALTER TABLE catalog_schema.catalog_items
  ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS variants JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_catalog_categories_parent
  ON catalog_schema.catalog_categories (tenant_id, parent_category_id, active);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'catalog_categories_parent_category_id_fkey'
  ) THEN
    ALTER TABLE catalog_schema.catalog_categories
      ADD CONSTRAINT catalog_categories_parent_category_id_fkey
      FOREIGN KEY (parent_category_id)
      REFERENCES catalog_schema.catalog_categories(id)
      ON DELETE SET NULL;
  END IF;
END $$;
