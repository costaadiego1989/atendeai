-- Add carrier field to commerce orders for tracking URL auto-generation.
-- Identifies the shipping carrier (CORREIOS, JADLOG, MELHOR_ENVIO, OTHER).

ALTER TABLE commerce_schema.orders ADD COLUMN IF NOT EXISTS carrier VARCHAR(30);
