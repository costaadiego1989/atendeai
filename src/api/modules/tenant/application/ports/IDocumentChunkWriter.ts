export interface IDocumentChunkWriter {
  countByDocument(tenantId: string, documentId: string): Promise<number>;
}

export const DOCUMENT_CHUNK_WRITER = Symbol('DOCUMENT_CHUNK_WRITER');
