ALTER TABLE "billing_schema"."subscriptions"
ADD COLUMN IF NOT EXISTS "scheduled_plan" VARCHAR(20);
