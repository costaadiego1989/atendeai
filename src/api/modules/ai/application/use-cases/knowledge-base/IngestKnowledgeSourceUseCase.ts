import { Injectable, Inject, Logger } from '@nestjs/common';
import { DocumentChunkingService } from '../../../domain/services/DocumentChunkingService';
import {
  IEmbeddingProvider,
  EMBEDDING_PROVIDER,
} from '../../ports/IEmbeddingProvider';
import {
  IDocumentChunkRepository,
  DOCUMENT_CHUNK_REPOSITORY,
} from '../../ports/IDocumentChunkRepository';
import {
  IKnowledgeSourceRepository,
  KNOWLEDGE_SOURCE_REPOSITORY,
} from '../../ports/IKnowledgeSourceRepository';
import { IKnowledgeSourceAdapter } from '../../ports/IKnowledgeSourceAdapter';
import { WebCrawlerAdapter } from '../../../infrastructure/adapters/knowledge-sources/WebCrawlerAdapter';
import { GoogleDriveAdapter } from '../../../infrastructure/adapters/knowledge-sources/GoogleDriveAdapter';
import { NotionAdapter } from '../../../infrastructure/adapters/knowledge-sources/NotionAdapter';

export interface IngestKnowledgeSourceInput {
  tenantId: string;
  sourceId: string;
  sourceType: 'webpage' | 'google-drive' | 'notion' | 'pdf';
  sourceUrl: string;
  sourceName: string;
  credentials?: Record<string, string>;
}

export interface IngestKnowledgeSourceResult {
  success: boolean;
  chunksCreated: number;
  contentHash: string;
  error?: string;
}

const INGEST_EMBEDDING_BATCH_SIZE = 50;

@Injectable()
export class IngestKnowledgeSourceUseCase {
  private readonly logger = new Logger(IngestKnowledgeSourceUseCase.name);
  private readonly adapters: Map<string, IKnowledgeSourceAdapter>;

  constructor(
    @Inject(KNOWLEDGE_SOURCE_REPOSITORY)
    private readonly knowledgeSourceRepository: IKnowledgeSourceRepository,
    private readonly chunkingService: DocumentChunkingService,
    @Inject(EMBEDDING_PROVIDER)
    private readonly embeddingProvider: IEmbeddingProvider,
    @Inject(DOCUMENT_CHUNK_REPOSITORY)
    private readonly chunkRepository: IDocumentChunkRepository,
    private readonly webCrawler: WebCrawlerAdapter,
    private readonly googleDrive: GoogleDriveAdapter,
    private readonly notion: NotionAdapter,
  ) {
    this.adapters = new Map<string, IKnowledgeSourceAdapter>([
      ['webpage', this.webCrawler],
      ['google-drive', this.googleDrive],
      ['notion', this.notion],
    ]);
  }

  async execute(
    input: IngestKnowledgeSourceInput,
  ): Promise<IngestKnowledgeSourceResult> {
    const adapter = this.adapters.get(input.sourceType);
    if (!adapter) {
      return {
        success: false,
        chunksCreated: 0,
        contentHash: '',
        error: `Unsupported source type: ${input.sourceType}`,
      };
    }

    try {
      await this.knowledgeSourceRepository.updateStatus(
        input.tenantId,
        input.sourceId,
        'INGESTING',
      );

      this.logger.log(`Ingesting ${input.sourceType}: ${input.sourceUrl}`);
      const result = await adapter.ingest(input.sourceUrl, input.credentials);

      const existingSource = await this.knowledgeSourceRepository.findById(
        input.tenantId,
        input.sourceId,
      );

      if (existingSource?.contentHash === result.contentHash) {
        await this.knowledgeSourceRepository.markSynced(
          input.tenantId,
          input.sourceId,
          'ACTIVE',
          result.contentHash,
        );
        this.logger.log(
          `Content unchanged for source ${input.sourceId}, skipping`,
        );
        return {
          success: true,
          chunksCreated: 0,
          contentHash: result.contentHash,
        };
      }

      const allChunks: {
        content: string;
        metadata: Record<string, unknown>;
      }[] = [];

      for (const content of result.contents) {
        const chunks = this.chunkingService.chunk(content.text);
        for (const chunk of chunks) {
          allChunks.push({
            content: chunk.content,
            metadata: {
              sourceTitle: content.title,
              sourceUrl: content.sourceUrl,
              pageNumber: content.pageNumber,
              section: content.section,
              chunkIndex: chunk.index,
              tokenCount: chunk.tokenCount,
            },
          });
        }
      }

      await this.chunkRepository.deleteByDocument(
        input.tenantId,
        input.sourceId,
      );

      let chunksCreated = 0;

      for (let i = 0; i < allChunks.length; i += INGEST_EMBEDDING_BATCH_SIZE) {
        const batch = allChunks.slice(i, i + INGEST_EMBEDDING_BATCH_SIZE);
        const texts = batch.map((c) => c.content);
        const embeddings =
          await this.embeddingProvider.generateEmbeddings(texts);

        const saveInputs = batch.map((chunk, idx) => ({
          tenantId: input.tenantId,
          documentId: input.sourceId,
          chunkIndex: i + idx,
          content: chunk.content,
          tokenCount: (chunk.metadata.tokenCount as number) || 0,
          embedding: embeddings[idx],
          metadata: chunk.metadata,
        }));

        await this.chunkRepository.saveChunks(saveInputs);
        chunksCreated += batch.length;
      }

      await this.knowledgeSourceRepository.markSynced(
        input.tenantId,
        input.sourceId,
        'ACTIVE',
        result.contentHash,
      );

      this.logger.log(
        `Ingested ${chunksCreated} chunks from ${input.sourceName}`,
      );
      return { success: true, chunksCreated, contentHash: result.contentHash };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Ingestion failed for ${input.sourceId}: ${message}`);
      await this.knowledgeSourceRepository.updateStatus(
        input.tenantId,
        input.sourceId,
        'ERROR',
      );
      return {
        success: false,
        chunksCreated: 0,
        contentHash: '',
        error: message,
      };
    }
  }
}
