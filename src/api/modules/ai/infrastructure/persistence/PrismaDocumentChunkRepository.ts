import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  IDocumentChunkRepository,
  SaveChunkInput,
  SimilarChunkResult,
} from '@modules/ai/application/ports/IDocumentChunkRepository';

@Injectable()
export class PrismaDocumentChunkRepository implements IDocumentChunkRepository {
  private readonly logger = new Logger(PrismaDocumentChunkRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async saveChunks(chunks: SaveChunkInput[]): Promise<void> {
    if (chunks.length === 0) return;

    // Insert in batches of 50 to avoid overly large queries
    const BATCH_SIZE = 50;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      await this.insertBatch(batch);
    }
  }

  private async insertBatch(chunks: SaveChunkInput[]): Promise<void> {
    const values = chunks.map(
      (chunk) => Prisma.sql`(
        ${chunk.tenantId}::uuid,
        ${chunk.documentId}::uuid,
        ${chunk.chunkIndex},
        ${chunk.content},
        ${chunk.tokenCount},
        ${JSON.stringify(chunk.metadata)}::jsonb,
        ${this.vectorLiteral(chunk.embedding)}::vector
      )`,
    );

    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO tenant_schema.tenant_document_chunks (
        tenant_id, document_id, chunk_index, content, token_count, metadata, embedding
      )
      VALUES ${Prisma.join(values)}
      ON CONFLICT (document_id, chunk_index)
      DO UPDATE SET
        content = EXCLUDED.content,
        token_count = EXCLUDED.token_count,
        metadata = EXCLUDED.metadata,
        embedding = EXCLUDED.embedding
    `);
  }

  async findSimilar(
    tenantId: string,
    embedding: number[],
    topK: number,
    threshold: number,
  ): Promise<SimilarChunkResult[]> {
    const vectorStr = this.vectorLiteral(embedding);

    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT
        c.id,
        c.tenant_id,
        c.document_id,
        c.chunk_index,
        c.content,
        c.token_count,
        c.metadata,
        1 - (c.embedding <=> ${vectorStr}::vector) AS similarity,
        d.file_name
      FROM tenant_schema.tenant_document_chunks c
      JOIN tenant_schema.tenant_pdf_resumes d ON d.id = c.document_id
      WHERE c.tenant_id = ${tenantId}::uuid
        AND 1 - (c.embedding <=> ${vectorStr}::vector) >= ${threshold}
      ORDER BY c.embedding <=> ${vectorStr}::vector
      LIMIT ${topK}
    `);

    return rows.map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      documentId: String(row.document_id),
      chunkIndex: Number(row.chunk_index),
      content: row.content,
      tokenCount: Number(row.token_count),
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      similarity: Number(row.similarity),
      fileName: row.file_name ?? undefined,
    }));
  }

  async deleteByDocument(documentId: string): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      DELETE FROM tenant_schema.tenant_document_chunks
      WHERE document_id = ${documentId}::uuid
    `);
  }

  async countByDocument(documentId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*) as count
      FROM tenant_schema.tenant_document_chunks
      WHERE document_id = ${documentId}::uuid
    `);

    return Number(rows[0]?.count ?? 0);
  }

  /**
   * Converts a number array to a pgvector literal string: '[0.1,0.2,...]'
   */
  private vectorLiteral(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
  }
}
