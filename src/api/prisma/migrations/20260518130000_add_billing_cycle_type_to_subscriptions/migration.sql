-- AlterTable
ALTER TABLE "billing_schema"."subscriptions" ADD COLUMN "billing_cycle_type" VARCHAR(10) NOT NULL DEFAULT 'MONTHLY';
