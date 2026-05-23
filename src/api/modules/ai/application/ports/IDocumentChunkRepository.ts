export interface DocumentChunkRecord {
  id: string;
  tenantId: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  metadata: Record<string, unknown>;
}

export interface SimilarChunkResult extends DocumentChunkRecord {
  similarity: number;
  fileName?: string;
}

export interface KeywordChunkResult {
  documentId: string;
  chunkIndex: number;
  content: string;
  metadata: Record<string, unknown>;
}

export interface SaveChunkInput {
  tenantId: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  metadata: Record<string, unknown>;
  embedding: number[];
}

export interface IDocumentChunkRepository {
  saveChunks(chunks: SaveChunkInput[]): Promise<void>;
  findSimilar(
    tenantId: string,
    embedding: number[],
    topK: number,
    threshold: number,
  ): Promise<SimilarChunkResult[]>;
  deleteByDocument(tenantId: string, documentId: string): Promise<void>;
  countByDocument(tenantId: string, documentId: string): Promise<number>;
  keywordSearch(
    tenantId: string,
    keywords: string[],
    limit: number,
  ): Promise<KeywordChunkResult[]>;
}

export const DOCUMENT_CHUNK_REPOSITORY = Symbol('DOCUMENT_CHUNK_REPOSITORY');
