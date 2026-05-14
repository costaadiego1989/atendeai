-- CreateTable
CREATE TABLE "support_schema"."feedback_replies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "feedback_id" UUID NOT NULL,
    "author_name" VARCHAR(100) NOT NULL,
    "message" TEXT NOT NULL,
    "sent_via" VARCHAR(30),
    "message_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "feedback_replies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_feedback_replies_feedback" ON "support_schema"."feedback_replies"("feedback_id");

-- AddForeignKey
ALTER TABLE "support_schema"."feedback_replies"
    ADD CONSTRAINT "feedback_replies_feedback_id_fkey"
    FOREIGN KEY ("feedback_id")
    REFERENCES "support_schema"."feedbacks"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
