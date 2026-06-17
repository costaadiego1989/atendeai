-- CreateTable: crm_tasks
CREATE TABLE IF NOT EXISTS "tenant_schema"."crm_tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "contact_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "due_at" TIMESTAMPTZ,
    "source" VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "crm_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_crm_tasks_tenant_status" ON "tenant_schema"."crm_tasks" ("tenant_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_crm_tasks_tenant_contact" ON "tenant_schema"."crm_tasks" ("tenant_id", "contact_id");
