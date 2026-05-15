export interface CachedRAGResponse {
  responseText: string;
  embedding: number[];
  createdAt: number;
}

export interface IRAGResponseCache {
  findSimilarResponse(
    tenantId: string,
    queryEmbedding: number[],
    threshold: number,
  ): Promise<string | null>;

  cacheResponse(
    tenantId: string,
    queryEmbedding: number[],
    responseText: string,
  ): Promise<void>;

  invalidateTenant(tenantId: string): Promise<void>;
}

export const RAG_RESPONSE_CACHE = Symbol('RAG_RESPONSE_CACHE');
