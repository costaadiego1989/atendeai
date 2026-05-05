-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "ai_schema";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "billing_schema";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "contact_schema";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "messaging_schema";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "sales_schema";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "tenant_schema";

-- CreateTable
CREATE TABLE "tenant_schema"."tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_name" VARCHAR(255) NOT NULL,
    "cnpj" VARCHAR(18) NOT NULL,
    "plan" VARCHAR(20) NOT NULL DEFAULT 'ESSENCIAL',
    "apiKey" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_type" VARCHAR(100),
    "description" TEXT,
    "services" TEXT,
    "zipcode" VARCHAR(20),
    "street" TEXT,
    "neighborhood" VARCHAR(100),
    "city" VARCHAR(100),
    "state" VARCHAR(50),
    "catalog_url" TEXT,
    "operating_hours" JSONB,
    "promotions" JSONB DEFAULT '[]',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_schema"."tenant_owners" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_schema"."whatsapp_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "bubble_whats_api_key" VARCHAR(255) NOT NULL,
    "whatsapp_number" VARCHAR(20) NOT NULL,
    "webhook_secret" VARCHAR(255) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "configured_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_schema"."ai_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "system_prompt" TEXT NOT NULL,
    "tone" VARCHAR(30) NOT NULL DEFAULT 'FRIENDLY',
    "language" VARCHAR(10) NOT NULL DEFAULT 'pt-BR',
    "max_tokens_per_response" INTEGER NOT NULL DEFAULT 500,
    "confidence_threshold" DECIMAL(3,2) NOT NULL DEFAULT 0.70,
    "escalation_message" TEXT,
    "business_rules" JSONB DEFAULT '[]',
    "sales_instructions" TEXT,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_schema"."contacts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "email" VARCHAR(255),
    "stage" VARCHAR(20) NOT NULL DEFAULT 'LEAD',
    "tags" JSONB DEFAULT '[]',
    "notes" TEXT,
    "last_interaction" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messaging_schema"."conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "channel" VARCHAR(20) NOT NULL DEFAULT 'WHATSAPP',
    "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messaging_schema"."messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "direction" VARCHAR(10) NOT NULL,
    "content_type" VARCHAR(20) NOT NULL DEFAULT 'TEXT',
    "content" JSONB NOT NULL,
    "sent_by" VARCHAR(10) NOT NULL,
    "delivery_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "external_id" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_schema"."ai_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "intent" VARCHAR(50),
    "sentiment" VARCHAR(20),
    "confidence" DECIMAL(3,2),
    "tokens_used" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_schema"."subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "plan" VARCHAR(20) NOT NULL DEFAULT 'ESSENCIAL',
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "messages_quota" INTEGER NOT NULL,
    "ai_tokens_quota" INTEGER NOT NULL,
    "contacts_quota" INTEGER NOT NULL,
    "billing_cycle_start" DATE NOT NULL,
    "billing_cycle_end" DATE NOT NULL,
    "asaas_customer_id" VARCHAR(50),
    "asaas_subscription_id" VARCHAR(50),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_schema"."usage_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "messages_used" INTEGER NOT NULL DEFAULT 0,
    "ai_tokens_used" INTEGER NOT NULL DEFAULT 0,
    "contacts_used" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_schema"."sales_metrics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "total_messages" INTEGER NOT NULL DEFAULT 0,
    "purchase_intents" INTEGER NOT NULL DEFAULT 0,
    "payment_links_generated" INTEGER NOT NULL DEFAULT 0,
    "estimated_revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_schema"."payment_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "external_id" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "url" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_cnpj_key" ON "tenant_schema"."tenants"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_apiKey_key" ON "tenant_schema"."tenants"("apiKey");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_owners_email_key" ON "tenant_schema"."tenant_owners"("email");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_configs_tenant_id_key" ON "tenant_schema"."whatsapp_configs"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_configs_tenant_id_key" ON "tenant_schema"."ai_configs"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_contacts_tenant_stage" ON "contact_schema"."contacts"("tenant_id", "stage");

-- CreateIndex
CREATE INDEX "idx_contacts_tenant_phone" ON "contact_schema"."contacts"("tenant_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_tenant_id_id_key" ON "contact_schema"."contacts"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_tenant_id_phone_key" ON "contact_schema"."contacts"("tenant_id", "phone");

-- CreateIndex
CREATE INDEX "idx_conversations_tenant_status" ON "messaging_schema"."conversations"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "idx_conversations_contact" ON "messaging_schema"."conversations"("contact_id", "status");

-- CreateIndex
CREATE INDEX "idx_messages_conversation" ON "messaging_schema"."messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_ai_sessions_conversation" ON "ai_schema"."ai_sessions"("conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_tenant_id_key" ON "billing_schema"."subscriptions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "usage_records_tenant_id_period_start_key" ON "billing_schema"."usage_records"("tenant_id", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "sales_metrics_tenant_id_date_key" ON "sales_schema"."sales_metrics"("tenant_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "payment_links_external_id_key" ON "sales_schema"."payment_links"("external_id");

-- AddForeignKey
ALTER TABLE "tenant_schema"."tenant_owners" ADD CONSTRAINT "tenant_owners_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_schema"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_schema"."whatsapp_configs" ADD CONSTRAINT "whatsapp_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_schema"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_schema"."ai_configs" ADD CONSTRAINT "ai_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_schema"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging_schema"."conversations" ADD CONSTRAINT "conversations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contact_schema"."contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging_schema"."messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "messaging_schema"."conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
