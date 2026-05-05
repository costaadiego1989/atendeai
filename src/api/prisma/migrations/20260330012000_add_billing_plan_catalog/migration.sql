CREATE TABLE IF NOT EXISTS "billing_schema"."billing_plan_catalog" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" VARCHAR(20) NOT NULL UNIQUE,
  "display_name" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "monthly_price" NUMERIC(12,2) NOT NULL,
  "messages_quota" INTEGER NOT NULL,
  "ai_tokens_quota" INTEGER NOT NULL,
  "contacts_quota" INTEGER NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
  ('ESSENCIAL', 'Essencial', 'Entrada para operações menores e onboarding rapido.', 0, 2000, 500000, 500, 1, TRUE),
  ('PROFISSIONAL', 'Profissional', 'Mais volume para times comerciais em crescimento.', 297, 10000, 2000000, 5000, 2, TRUE),
  ('ESCALA', 'Escala', 'Capacidade alta para operações intensivas e multi-times.', 597, 100000, 10000000, 50000, 3, TRUE)
ON CONFLICT ("code") DO NOTHING;
