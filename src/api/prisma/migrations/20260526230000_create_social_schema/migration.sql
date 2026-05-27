-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "social_schema";

-- CreateTable: social_accounts
CREATE TABLE IF NOT EXISTS "social_schema"."social_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "platform" VARCHAR(20) NOT NULL,
    "external_account_id" VARCHAR(255) NOT NULL,
    "username" VARCHAR(255),
    "display_name" VARCHAR(255),
    "profile_picture_url" TEXT,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "token_expires_at" TIMESTAMPTZ,
    "page_id" VARCHAR(255),
    "webhook_secret" VARCHAR(255),
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "connected_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: social_posts
CREATE TABLE IF NOT EXISTS "social_schema"."social_posts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "social_account_id" UUID NOT NULL,
    "platform" VARCHAR(20) NOT NULL,
    "external_post_id" VARCHAR(255) NOT NULL,
    "post_type" VARCHAR(30),
    "caption" TEXT,
    "media_url" TEXT,
    "permalink" TEXT,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "posted_at" TIMESTAMPTZ,
    "discovered_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "social_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: social_comments
CREATE TABLE IF NOT EXISTS "social_schema"."social_comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "social_account_id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "platform" VARCHAR(20) NOT NULL,
    "external_comment_id" VARCHAR(255) NOT NULL,
    "parent_comment_id" UUID,
    "author_external_id" VARCHAR(255),
    "author_username" VARCHAR(255),
    "author_name" VARCHAR(255),
    "text" TEXT NOT NULL,
    "sentiment" VARCHAR(20),
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "replied_at" TIMESTAMPTZ,

    CONSTRAINT "social_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: social_comment_replies
CREATE TABLE IF NOT EXISTS "social_schema"."social_comment_replies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "comment_id" UUID NOT NULL,
    "external_reply_id" VARCHAR(255),
    "text" TEXT NOT NULL,
    "replied_by" VARCHAR(20) NOT NULL,
    "rule_id" UUID,
    "user_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'SENT',
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "social_comment_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable: social_auto_reply_rules
CREATE TABLE IF NOT EXISTS "social_schema"."social_auto_reply_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "platform" VARCHAR(20) NOT NULL DEFAULT 'INSTAGRAM',
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "actions" JSONB NOT NULL DEFAULT '{}',
    "limits" JSONB NOT NULL DEFAULT '{}',
    "total_fired" INTEGER NOT NULL DEFAULT 0,
    "last_fired_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "social_auto_reply_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable: social_inbox_threads
CREATE TABLE IF NOT EXISTS "social_schema"."social_inbox_threads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "social_account_id" UUID NOT NULL,
    "platform" VARCHAR(20) NOT NULL,
    "recipient_external_id" VARCHAR(255) NOT NULL,
    "recipient_username" VARCHAR(255),
    "origin_comment_id" UUID,
    "last_message_text" TEXT,
    "last_message_at" TIMESTAMPTZ,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "social_inbox_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable: social_audit_log
CREATE TABLE IF NOT EXISTS "social_schema"."social_audit_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "event" VARCHAR(50) NOT NULL,
    "entity_id" UUID,
    "entity_type" VARCHAR(30),
    "platform" VARCHAR(20),
    "rule_id" UUID,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "social_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: social_accounts
CREATE UNIQUE INDEX IF NOT EXISTS "uq_social_accounts_tenant_platform_ext" ON "social_schema"."social_accounts"("tenant_id", "platform", "external_account_id");
CREATE INDEX IF NOT EXISTS "idx_social_accounts_tenant_platform" ON "social_schema"."social_accounts"("tenant_id", "platform");

-- CreateIndex: social_posts
CREATE UNIQUE INDEX IF NOT EXISTS "uq_social_posts_tenant_ext" ON "social_schema"."social_posts"("tenant_id", "external_post_id");
CREATE INDEX IF NOT EXISTS "idx_social_posts_tenant_account" ON "social_schema"."social_posts"("tenant_id", "social_account_id");

-- CreateIndex: social_comments
CREATE UNIQUE INDEX IF NOT EXISTS "uq_social_comments_tenant_ext" ON "social_schema"."social_comments"("tenant_id", "external_comment_id");
CREATE INDEX IF NOT EXISTS "idx_social_comments_tenant_post_status" ON "social_schema"."social_comments"("tenant_id", "post_id", "status");
CREATE INDEX IF NOT EXISTS "idx_social_comments_tenant_status" ON "social_schema"."social_comments"("tenant_id", "status");

-- CreateIndex: social_comment_replies
CREATE INDEX IF NOT EXISTS "idx_social_comment_replies_tenant_comment" ON "social_schema"."social_comment_replies"("tenant_id", "comment_id");

-- CreateIndex: social_auto_reply_rules
CREATE INDEX IF NOT EXISTS "idx_social_auto_reply_rules_tenant_active" ON "social_schema"."social_auto_reply_rules"("tenant_id", "is_active");

-- CreateIndex: social_inbox_threads
CREATE UNIQUE INDEX IF NOT EXISTS "uq_social_inbox_threads_tenant_recipient" ON "social_schema"."social_inbox_threads"("tenant_id", "platform", "recipient_external_id");
CREATE INDEX IF NOT EXISTS "idx_social_inbox_threads_tenant_status" ON "social_schema"."social_inbox_threads"("tenant_id", "status");

-- CreateIndex: social_audit_log
CREATE INDEX IF NOT EXISTS "social_audit_log_tenant_id_idx" ON "social_schema"."social_audit_log"("tenant_id");
CREATE INDEX IF NOT EXISTS "social_audit_log_entity_id_idx" ON "social_schema"."social_audit_log"("entity_id");
