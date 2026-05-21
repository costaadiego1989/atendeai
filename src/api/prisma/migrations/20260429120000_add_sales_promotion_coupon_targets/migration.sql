-- Ensure base tables exist before FK references.
-- sales_promotions and sales_coupons were historically created via db push.
-- IF NOT EXISTS makes this idempotent on production databases.
CREATE TABLE IF NOT EXISTS sales_schema.sales_promotions (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID          NOT NULL,
  title          VARCHAR(255)  NOT NULL,
  description    TEXT          NOT NULL DEFAULT '',
  discount_type  VARCHAR(20)   NOT NULL,
  discount_value DECIMAL(12,2) NOT NULL,
  minimum_order  DECIMAL(12,2),
  image_url      TEXT,
  starts_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  expires_at     TIMESTAMPTZ,
  active         BOOLEAN       NOT NULL DEFAULT true,
  catalog_item_id UUID,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_promotions_tenant_active
  ON sales_schema.sales_promotions (tenant_id, active);

CREATE TABLE IF NOT EXISTS sales_schema.sales_coupons (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID          NOT NULL,
  promotion_id   UUID          REFERENCES sales_schema.sales_promotions (id),
  code           VARCHAR(50)   NOT NULL,
  description    TEXT,
  discount_type  VARCHAR(20)   NOT NULL,
  discount_value DECIMAL(12,2) NOT NULL,
  max_uses       INT           NOT NULL DEFAULT 0,
  used_count     INT           NOT NULL DEFAULT 0,
  starts_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  expires_at     TIMESTAMPTZ,
  active         BOOLEAN       NOT NULL DEFAULT true,
  catalog_item_id UUID,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_sales_coupons_tenant_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_sales_coupons_tenant_active
  ON sales_schema.sales_coupons (tenant_id, active);

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
