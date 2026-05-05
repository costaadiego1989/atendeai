CREATE TABLE IF NOT EXISTS "shared_schema"."password_reset_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_token_hash_key"
ON "shared_schema"."password_reset_tokens"("token_hash");

CREATE INDEX IF NOT EXISTS "idx_password_reset_tokens_user_exp"
ON "shared_schema"."password_reset_tokens"("user_id", "expires_at");

CREATE INDEX IF NOT EXISTS "idx_password_reset_tokens_email_exp"
ON "shared_schema"."password_reset_tokens"("email", "expires_at");
