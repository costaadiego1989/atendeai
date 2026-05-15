export interface IEmbeddingProvider {
  generateEmbedding(text: string): Promise<number[]>;
  generateEmbeddings(texts: string[]): Promise<number[][]>;
}

export const EMBEDDING_PROVIDER = Symbol('EMBEDDING_PROVIDER');
