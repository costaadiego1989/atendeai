import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  IEmbeddingProvider,
  EMBEDDING_PROVIDER,
} from '../../ports/IEmbeddingProvider';
import {
  IDocumentChunkRepository,
  DOCUMENT_CHUNK_REPOSITORY,
} from '../../ports/IDocumentChunkRepository';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  Citation,
  RAGResultWithCitations,
} from '../../../domain/value-objects/Citation';

export interface HybridSearchInput {
  tenantId: string;
  query: string;
  topK?: number;
  threshold?: number;
}

@Injectable()
export class HybridSearchService {
  private readonly logger = new Logger(HybridSearchService.name);
  private readonly defaultTopK = 5;
  private readonly defaultThreshold = 0.7;

  constructor(
    @Inject(EMBEDDING_PROVIDER)
    private readonly embeddingProvider: IEmbeddingProvider,
    @Inject(DOCUMENT_CHUNK_REPOSITORY)
    private readonly chunkRepository: IDocumentChunkRepository,
    private readonly prisma: PrismaService,
  ) {}

  async search(input: HybridSearchInput): Promise<RAGResultWithCitations> {
    const topK = input.topK || this.defaultTopK;
    const threshold = input.threshold || this.defaultThreshold;
    const queryEmbedding = await this.embeddingProvider.generateEmbedding(
      input.query,
    );

    const vectorResults = await this.chunkRepository.findSimilar(
      input.tenantId,
      queryEmbedding,
      topK * 2, // Fetch more for reranking
      threshold,
    );

    const keywordResults = await this.keywordSearch(
      input.tenantId,
      input.query,
      topK,
    );
    const merged = this.mergeResults(vectorResults, keywordResults);

    const reranked = merged.sort((a, b) => b.score - a.score).slice(0, topK);

    if (reranked.length === 0) {
      return { context: '', citations: [] };
    }

    const citations: Citation[] = [];
    const contextParts: string[] = [];

    for (const result of reranked) {
      contextParts.push(result.content);

      citations.push({
        sourceId: result.documentId,
        sourceType: result.metadata?.sourceType || 'document',
        sourceTitle: (result.metadata?.sourceTitle as string) || 'Documento',
        sourceUrl: result.metadata?.sourceUrl as string | undefined,
        pageNumber: result.metadata?.pageNumber as number | undefined,
        section: result.metadata?.section as string | undefined,
        relevanceScore: result.score,
        snippet: result.content.substring(0, 150) + '...',
      });
    }

    const context = contextParts.join('\n\n---\n\n');

    return { context, citations };
  }

  private async keywordSearch(
    tenantId: string,
    query: string,
    limit: number,
  ): Promise<
    { documentId: string; content: string; score: number; metadata: any }[]
  > {
    // Extract keywords (remove stop words, keep meaningful terms)
    const keywords = this.extractKeywords(query);
    if (keywords.length === 0) return [];

    const searchPattern = keywords.join('|');

    try {
      const chunks = await this.prisma.tenantDocumentChunk.findMany({
        where: {
          tenantId,
          content: { contains: keywords[0] }, // Primary keyword
        },
        take: limit * 2,
        orderBy: { createdAt: 'desc' },
      });

      return chunks
        .map((chunk: any) => {
          // Score based on keyword matches
          const matchCount = keywords.filter((kw) =>
            chunk.content.toLowerCase().includes(kw.toLowerCase()),
          ).length;
          const score = matchCount / keywords.length;

          return {
            documentId: chunk.documentId,
            content: chunk.content,
            score: score * 0.8, // Keyword score weighted lower than vector
            metadata: chunk.metadata,
          };
        })
        .filter((r) => r.score > 0.3)
        .slice(0, limit);
    } catch {
      return [];
    }
  }

  private mergeResults(
    vectorResults: any[],
    keywordResults: any[],
  ): { documentId: string; content: string; score: number; metadata: any }[] {
    const seen = new Set<string>();
    const merged: {
      documentId: string;
      content: string;
      score: number;
      metadata: any;
    }[] = [];

    for (const r of vectorResults) {
      const key = `${r.documentId}:${r.chunkIndex}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push({
          documentId: r.documentId,
          content: r.content,
          score: r.similarity,
          metadata: r.metadata,
        });
      }
    }

    for (const r of keywordResults) {
      const existingIdx = merged.findIndex((m) => m.content === r.content);
      if (existingIdx >= 0) {
        // Boost score for results found by both methods
        merged[existingIdx].score = Math.min(
          1,
          merged[existingIdx].score + 0.1,
        );
      } else {
        merged.push(r);
      }
    }

    return merged;
  }

  private extractKeywords(query: string): string[] {
    const stopWords = new Set([
      'o',
      'a',
      'os',
      'as',
      'um',
      'uma',
      'de',
      'do',
      'da',
      'dos',
      'das',
      'em',
      'no',
      'na',
      'nos',
      'nas',
      'por',
      'para',
      'com',
      'sem',
      'que',
      'e',
      'ou',
      'mas',
      'se',
      'como',
      'qual',
      'quais',
      'quando',
      'onde',
      'é',
      'são',
      'foi',
      'ser',
      'ter',
      'está',
      'isso',
      'este',
      'esta',
      'esse',
      'essa',
      'aquele',
      'aquela',
      'meu',
      'seu',
      'nosso',
    ]);

    return query
      .toLowerCase()
      .replace(/[^\w\sáéíóúâêôãõç]/g, '')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word));
  }
}
