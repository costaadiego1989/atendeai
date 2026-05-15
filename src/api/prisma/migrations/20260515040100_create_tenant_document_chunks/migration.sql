-- CreateTable
CREATE TABLE "tenant_schema"."tenant_document_chunks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "document_id" UUID NOT NULL,
  "chunk_index" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "token_count" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB DEFAULT '{}',
  "embedding" vector(1536) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "tenant_document_chunks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "uq_chunk_per_doc" UNIQUE ("document_id", "chunk_index"),
  CONSTRAINT "fk_chunk_document" FOREIGN KEY ("document_id")
    REFERENCES "tenant_schema"."tenant_pdf_resumes"("id") ON DELETE CASCADE
);

-- CreateIndex
CREATE INDEX "idx_chunks_tenant" ON "tenant_schema"."tenant_document_chunks"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_chunks_document" ON "tenant_schema"."tenant_document_chunks"("document_id");

-- CreateIndex (HNSW for vector similarity search)
CREATE INDEX "idx_chunks_embedding" ON "tenant_schema"."tenant_document_chunks"
  USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64);
