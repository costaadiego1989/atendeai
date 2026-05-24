import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import axios from 'axios';
import { DocumentChunkingService } from '@modules/ai/domain/services/DocumentChunkingService';
import {
  IEmbeddingProvider,
  EMBEDDING_PROVIDER,
} from '@modules/ai/application/ports/IEmbeddingProvider';
import {
  IDocumentChunkRepository,
  DOCUMENT_CHUNK_REPOSITORY,
} from '@modules/ai/application/ports/IDocumentChunkRepository';
import {
  IRAGResponseCache,
  RAG_RESPONSE_CACHE,
} from '@modules/ai/application/ports/IRAGResponseCache';
import {
  ITenantPDFResumeQueryPort,
  TENANT_PDF_RESUME_QUERY_PORT,
} from '@modules/tenant/application/facades/TenantPDFResumeFacade';
import { traceAsync } from '@shared/infrastructure/observability/DomainTrace';

type PdfParseResult = {
  text: string;
  numpages: number;
  info: Record<string, unknown>;
};

const pdfParse: (
  dataBuffer: Buffer,
) => Promise<PdfParseResult> = require('pdf-parse');

export interface ProcessDocumentForRAGInput {
  tenantId: string;
  documentId: string;
  fileUrl: string;
  fileName: string;
}

const EMBEDDING_BATCH_SIZE = 100;

@Injectable()
export class ProcessDocumentForRAGUseCase {
  private readonly logger = new Logger(ProcessDocumentForRAGUseCase.name);

  constructor(
    private readonly chunkingService: DocumentChunkingService,
    @Inject(EMBEDDING_PROVIDER)
    private readonly embeddingProvider: IEmbeddingProvider,
    @Inject(DOCUMENT_CHUNK_REPOSITORY)
    private readonly chunkRepository: IDocumentChunkRepository,
    @Inject(TENANT_PDF_RESUME_QUERY_PORT)
    private readonly pdfResumeQueryPort: ITenantPDFResumeQueryPort,
    @Optional()
    @Inject(RAG_RESPONSE_CACHE)
    private readonly ragResponseCache?: IRAGResponseCache,
  ) {}

  async execute(input: ProcessDocumentForRAGInput): Promise<void> {
    const { tenantId, documentId, fileUrl, fileName } = input;

    return traceAsync(
      'ai.ProcessDocumentForRAG.execute',
      {
        'tenant.id': tenantId,
        'document.id': documentId,
        'document.fileName': fileName,
      },
      async () => this.processDocument(tenantId, documentId, fileUrl, fileName),
    );
  }

  private async processDocument(
    tenantId: string,
    documentId: string,
    fileUrl: string,
    fileName: string,
  ): Promise<void> {
    try {
      // 1. Update status to EXTRACTING
      await this.updateStatus(tenantId, documentId, 'EXTRACTING');

      // 2. Download PDF from S3
      const pdfBuffer = await this.downloadPDF(fileUrl);

      // 3. Extract text with pdf-parse
      const text = await this.extractText(pdfBuffer);
      if (!text.trim()) {
        await this.updateStatus(
          tenantId,
          documentId,
          'ERROR',
          'PDF sem texto extraível',
        );
        return;
      }

      // 4. Update status to CHUNKING
      await this.updateStatus(tenantId, documentId, 'CHUNKING');

      // 5. Chunk the text
      const chunks = this.chunkingService.chunk(text);
      if (chunks.length === 0) {
        await this.updateStatus(
          tenantId,
          documentId,
          'ERROR',
          'Nenhum chunk gerado',
        );
        return;
      }

      this.logger.log(
        `[ProcessDocumentForRAG] doc=${documentId} chunks=${chunks.length}`,
      );

      // 6. Update status to EMBEDDING
      await this.updateStatus(tenantId, documentId, 'EMBEDDING');

      // 7. Delete old chunks (in case of reprocessing)
      await this.chunkRepository.deleteByDocument(tenantId, documentId);

      // 8. Generate embeddings in batches and save
      for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
        const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
        const texts = batch.map((c) => c.content);
        const embeddings =
          await this.embeddingProvider.generateEmbeddings(texts);

        const chunkInputs = batch.map((chunk, batchIdx) => ({
          tenantId,
          documentId,
          chunkIndex: chunk.index,
          content: chunk.content,
          tokenCount: chunk.tokenCount,
          metadata: { fileName, chunkIndex: chunk.index } as Record<
            string,
            unknown
          >,
          embedding: embeddings[batchIdx],
        }));

        await this.chunkRepository.saveChunks(chunkInputs);
      }

      // 9. Update status to READY
      await this.updateStatus(tenantId, documentId, 'READY');

      // 10. Invalidate RAG response cache for this tenant (chunks changed)
      if (this.ragResponseCache) {
        await this.ragResponseCache.invalidateTenant(tenantId);
      }

      this.logger.log(
        `[ProcessDocumentForRAG] completed doc=${documentId} fileName=${fileName} chunks=${chunks.length}`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `[ProcessDocumentForRAG] failed doc=${documentId}: ${message}`,
      );
      await this.updateStatus(
        tenantId,
        documentId,
        'ERROR',
        message.slice(0, 500),
      );
    }
  }

  private async downloadPDF(fileUrl: string): Promise<Buffer> {
    const response = await axios.get(fileUrl, {
      responseType: 'arraybuffer',
      timeout: 60_000,
    });
    return Buffer.from(response.data);
  }

  private async extractText(pdfBuffer: Buffer): Promise<string> {
    const result = await pdfParse(pdfBuffer);
    return result.text || '';
  }

  private async updateStatus(
    tenantId: string,
    documentId: string,
    status: string,
    error?: string,
  ): Promise<void> {
    await this.pdfResumeQueryPort.updateStatus(
      tenantId,
      documentId,
      status,
      error ?? null,
    );
  }
}
