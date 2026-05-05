-- Alterar o schema padrão das tabelas tenant e subscriptions para o novo default
ALTER TABLE "tenant_schema"."tenants" ALTER COLUMN "plan" SET DEFAULT 'TRIAL';
ALTER TABLE "billing_schema"."subscriptions" ALTER COLUMN "plan" SET DEFAULT 'TRIAL';

INSERT INTO "billing_schema"."billing_plan_catalog" (
  "code",
  "display_name",
  "description",
  "monthly_price",
  "messages_quota",
  "ai_tokens_quota",
  "contacts_quota",
  "sort_order",
  "active"
) VALUES
  ('TRIAL', 'Trial', 'Período de teste gratuito de 7 dias com recursos essenciais.', 0, 2000, 500000, 500, 0, TRUE)
ON CONFLICT ("code") DO NOTHING;
