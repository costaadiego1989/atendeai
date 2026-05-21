/**
 * Port for knowledge source ingestion.
 * Each source type (web, Google Drive, Notion, spreadsheet) implements this interface.
 */

export interface KnowledgeSourceContent {
  title: string;
  text: string;
  sourceUrl?: string;
  pageNumber?: number;
  section?: string;
  metadata?: Record<string, unknown>;
}

export interface IngestResult {
  contents: KnowledgeSourceContent[];
  contentHash: string;
}

export interface IKnowledgeSourceAdapter {
  readonly sourceType: string;
  ingest(
    sourceUrl: string,
    credentials?: Record<string, string>,
  ): Promise<IngestResult>;
}

export const KNOWLEDGE_SOURCE_ADAPTERS = Symbol('KNOWLEDGE_SOURCE_ADAPTERS');
