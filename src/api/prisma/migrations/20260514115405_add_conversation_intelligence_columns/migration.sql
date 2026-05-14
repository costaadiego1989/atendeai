-- AlterTable
ALTER TABLE "messaging_schema"."conversation_intelligence"
ADD COLUMN "next_step" TEXT,
ADD COLUMN "loss_reason" TEXT;

-- CreateIndex
ALTER TABLE "messaging_schema"."conversation_intelligence"
ADD CONSTRAINT "uq_conversation_intelligence_tenant_conversation" UNIQUE ("tenant_id", "conversation_id");
