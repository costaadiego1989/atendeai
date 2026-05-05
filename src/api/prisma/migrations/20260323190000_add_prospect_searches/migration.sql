CREATE SCHEMA IF NOT EXISTS "prospecting_schema";

CREATE TABLE IF NOT EXISTS "prospecting_schema"."prospect_searches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "business_type_query" VARCHAR(255) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(50),
    "source" VARCHAR(30) NOT NULL DEFAULT 'GOOGLE_PLACES',
    "max_results" INTEGER NOT NULL DEFAULT 50,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "discovered_count" INTEGER NOT NULL DEFAULT 0,
    "failure_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospect_searches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "prospect_searches_tenant_id_id_key"
ON "prospecting_schema"."prospect_searches"("tenant_id", "id");

CREATE INDEX IF NOT EXISTS "idx_prospect_searches_tenant_status"
ON "prospecting_schema"."prospect_searches"("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "prospecting_schema"."prospect_search_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "search_id" UUID NOT NULL,
    "source" VARCHAR(30) NOT NULL,
    "external_id" VARCHAR(255),
    "business_name" VARCHAR(255) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(50),
    "phone" VARCHAR(30),
    "email" VARCHAR(255),
    "website" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospect_search_results_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_prospect_search_results_tenant_search"
ON "prospecting_schema"."prospect_search_results"("tenant_id", "search_id");
