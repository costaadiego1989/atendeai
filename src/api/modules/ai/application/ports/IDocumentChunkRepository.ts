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
  deleteByDocument(documentId: string): Promise<void>;
  countByDocument(documentId: string): Promise<number>;
}

export const DOCUMENT_CHUNK_REPOSITORY = Symbol('DOCUMENT_CHUNK_REPOSITORY');
