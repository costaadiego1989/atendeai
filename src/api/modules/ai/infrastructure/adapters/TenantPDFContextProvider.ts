import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ITenantPDFResumeQueryPort,
  TENANT_PDF_RESUME_QUERY_PORT,
} from '@modules/tenant/application/facades/TenantPDFResumeFacade';
import { ITenantPDFContextProvider } from '../../application/ports/ITenantPDFContextProvider';
import {
  IEmbeddingProvider,
  EMBEDDING_PROVIDER,
} from '../../application/ports/IEmbeddingProvider';
import {
  IDocumentChunkRepository,
  DOCUMENT_CHUNK_REPOSITORY,
  SimilarChunkResult,
} from '../../application/ports/IDocumentChunkRepository';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TenantPDFContextProvider implements ITenantPDFContextProvider {
  private readonly logger = new Logger(TenantPDFContextProvider.name);
  private readonly similarityThreshold: number;
  private readonly topK: number;

  constructor(
    @Inject(TENANT_PDF_RESUME_QUERY_PORT)
    private readonly pdfResumeQueryPort: ITenantPDFResumeQueryPort,
    @Inject(EMBEDDING_PROVIDER)
    private readonly embeddingProvider: IEmbeddingProvider,
    @Inject(DOCUMENT_CHUNK_REPOSITORY)
    private readonly chunkRepository: IDocumentChunkRepository,
    private readonly configService: ConfigService,
  ) {
    const rawThreshold = Number(
      this.configService.get<string>('RAG_SIMILARITY_THRESHOLD'),
    );
    this.similarityThreshold =
      Number.isFinite(rawThreshold) && rawThreshold > 0 ? rawThreshold : 0.7;

    const rawTopK = Number(this.configService.get<string>('RAG_TOP_K'));
    this.topK = Number.isFinite(rawTopK) && rawTopK > 0 ? rawTopK : 5;
  }

  async findRelevantPDFContext(
    tenantId: string,
    userMessage: string,
  ): Promise<string | null> {
    try {
      // Try RAG-based retrieval first
      const ragContext = await this.findRAGContext(tenantId, userMessage);
      if (ragContext) return ragContext;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'unknown';
      this.logger.warn(
        `[TenantPDFContextProvider] RAG fallback to summaries: ${msg}`,
      );
    }

    // Fallback: use legacy summaries approach
    return this.findLegacyContext(tenantId);
  }

  private async findRAGContext(
    tenantId: string,
    userMessage: string,
  ): Promise<string | null> {
    // Generate embedding for the user's question
    const queryEmbedding =
      await this.embeddingProvider.generateEmbedding(userMessage);

    // Search for similar chunks
    const chunks = await this.chunkRepository.findSimilar(
      tenantId,
      queryEmbedding,
      this.topK,
      this.similarityThreshold,
    );

    if (chunks.length === 0) return null;

    // Format with source citations
    return this.formatRAGResponse(chunks);
  }

  private formatRAGResponse(chunks: SimilarChunkResult[]): string {
    const header =
      '[CONTEXTO DE DOCUMENTOS DA EMPRESA - BUSCA INTELIGENTE]:\n' +
      'Os trechos abaixo foram selecionados por relevância à pergunta do cliente.\n' +
      'Ao usar informações destes documentos, cite a fonte entre parênteses.\n';

    const formattedChunks = chunks.map((chunk) => {
      const source = chunk.fileName ?? 'Documento';
      return (
        `[FONTE: "${source}", trecho ${chunk.chunkIndex + 1}]:\n` +
        chunk.content.trim()
      );
    });

    return header + '\n' + formattedChunks.join('\n\n');
  }

  /**
   * Legacy fallback: concatenate summaries from all READY documents.
   * Used when no RAG chunks are indexed or when embedding fails.
   */
  private async findLegacyContext(tenantId: string): Promise<string | null> {
    const docs = await this.pdfResumeQueryPort.listReadyWithMeta(tenantId);
    if (!docs.length) return null;

    const parts: string[] = [];
    let summaryIndex = 1;

    for (const doc of docs.slice(0, 8)) {
      const docSummaries = doc.summaries.slice(0, 4);
      if (!docSummaries.length) continue;

      const summaryLines = docSummaries
        .map((s) => `${summaryIndex++}. ${s}`)
        .join('\n');
      parts.push(summaryLines);

      if (doc.canSendIt && doc.fileUrl) {
        parts.push(
          `[DOCUMENTO DISPONÍVEL PARA ENVIO AO CLIENTE - "${doc.fileName}"]: ${doc.fileUrl}\n` +
            `Instrução: Se o cliente solicitar este documento ou quiser ver mais detalhes, envie este link diretamente na resposta.`,
        );
      }
    }

    return parts.length > 0 ? parts.join('\n\n') : null;
  }
}
