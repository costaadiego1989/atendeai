import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { DocumentChunkingService } from '../../../domain/services/DocumentChunkingService';
import {
  IEmbeddingProvider,
  EMBEDDING_PROVIDER,
} from '../../ports/IEmbeddingProvider';
import {
  IDocumentChunkRepository,
  DOCUMENT_CHUNK_REPOSITORY,
} from '../../ports/IDocumentChunkRepository';
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

@Injectable()
export class IngestKnowledgeSourceUseCase {
  private readonly logger = new Logger(IngestKnowledgeSourceUseCase.name);
  private readonly adapters: Map<string, IKnowledgeSourceAdapter>;

  constructor(
    private readonly prisma: PrismaService,
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
      // 1. Update source status
      await this.prisma.knowledgeSource.update({
        where: { id: input.sourceId },
        data: { status: 'INGESTING' },
      });

      // 2. Ingest content from source
      this.logger.log(`Ingesting ${input.sourceType}: ${input.sourceUrl}`);
      const result = await adapter.ingest(input.sourceUrl, input.credentials);

      // 3. Check if content changed
      const existingSource = await this.prisma.knowledgeSource.findUnique({
        where: { id: input.sourceId },
      });

      if (existingSource?.contentHash === result.contentHash) {
        await this.prisma.knowledgeSource.update({
          where: { id: input.sourceId },
          data: { status: 'ACTIVE', lastSyncAt: new Date() },
        });
        this.logger.log(
          `Content unchanged for source ${input.sourceId}, skipping`,
        );
        return {
          success: true,
          chunksCreated: 0,
          contentHash: result.contentHash,
        };
      }

      // 4. Chunk all content
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

      // 5. Delete old chunks for this source
      await this.chunkRepository.deleteByDocument(input.sourceId);

      // 6. Generate embeddings and save in batches
      const BATCH_SIZE = 50;
      let chunksCreated = 0;

      for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
        const batch = allChunks.slice(i, i + BATCH_SIZE);
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

      // 7. Update source status
      await this.prisma.knowledgeSource.update({
        where: { id: input.sourceId },
        data: {
          status: 'ACTIVE',
          contentHash: result.contentHash,
          lastSyncAt: new Date(),
        },
      });

      this.logger.log(
        `Ingested ${chunksCreated} chunks from ${input.sourceName}`,
      );
      return { success: true, chunksCreated, contentHash: result.contentHash };
    } catch (error: any) {
      this.logger.error(
        `Ingestion failed for ${input.sourceId}: ${error.message}`,
      );
      await this.prisma.knowledgeSource.update({
        where: { id: input.sourceId },
        data: { status: 'ERROR' },
      });
      return {
        success: false,
        chunksCreated: 0,
        contentHash: '',
        error: error.message,
      };
    }
  }
}
