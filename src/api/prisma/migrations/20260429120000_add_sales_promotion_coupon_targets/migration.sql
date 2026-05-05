CREATE TABLE IF NOT EXISTS sales_schema.sales_promotion_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL,
  target_type VARCHAR(20) NOT NULL,
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sales_promotion_targets_promotion_id_fkey
    FOREIGN KEY (promotion_id)
    REFERENCES sales_schema.sales_promotions (id)
    ON DELETE CASCADE,
  CONSTRAINT sales_promotion_targets_target_type_check
    CHECK (target_type IN ('ITEM', 'CATEGORY'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_promotion_targets_target
  ON sales_schema.sales_promotion_targets (promotion_id, target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_sales_promotion_targets_lookup
  ON sales_schema.sales_promotion_targets (target_type, target_id);

INSERT INTO sales_schema.sales_promotion_targets (promotion_id, target_type, target_id)
SELECT id, 'ITEM', catalog_item_id
FROM sales_schema.sales_promotions
WHERE catalog_item_id IS NOT NULL
ON CONFLICT (promotion_id, target_type, target_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS sales_schema.sales_coupon_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL,
  target_type VARCHAR(20) NOT NULL,
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sales_coupon_targets_coupon_id_fkey
    FOREIGN KEY (coupon_id)
    REFERENCES sales_schema.sales_coupons (id)
    ON DELETE CASCADE,
  CONSTRAINT sales_coupon_targets_target_type_check
    CHECK (target_type IN ('ITEM', 'CATEGORY'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_coupon_targets_target
  ON sales_schema.sales_coupon_targets (coupon_id, target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_sales_coupon_targets_lookup
  ON sales_schema.sales_coupon_targets (target_type, target_id);

INSERT INTO sales_schema.sales_coupon_targets (coupon_id, target_type, target_id)
SELECT id, 'ITEM', catalog_item_id
FROM sales_schema.sales_coupons
WHERE catalog_item_id IS NOT NULL
ON CONFLICT (coupon_id, target_type, target_id) DO NOTHING;
