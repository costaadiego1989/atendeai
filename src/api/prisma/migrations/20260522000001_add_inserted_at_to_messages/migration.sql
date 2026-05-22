-- AlterTable
ALTER TABLE "messaging_schema"."messages" ADD COLUMN "inserted_at" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp();

-- CreateIndex
CREATE INDEX "idx_messages_conversation_inserted" ON "messaging_schema"."messages"("conversation_id", "inserted_at");
