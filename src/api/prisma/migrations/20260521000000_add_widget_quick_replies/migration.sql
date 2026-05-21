-- Generated via: prisma migrate diff --from-schema-datasource --to-schema-datamodel
-- AlterTable
ALTER TABLE "messaging_schema"."widget_configs" ADD COLUMN "quick_replies" JSONB NOT NULL DEFAULT '[]';
