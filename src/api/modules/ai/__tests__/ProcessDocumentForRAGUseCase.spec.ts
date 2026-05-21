import axios from 'axios';
import { ProcessDocumentForRAGUseCase } from '../application/use-cases/ProcessDocumentForRAGUseCase';
import { DocumentChunkingService } from '../domain/services/DocumentChunkingService';
import { IEmbeddingProvider } from '../application/ports/IEmbeddingProvider';
import { IDocumentChunkRepository } from '../application/ports/IDocumentChunkRepository';
import { IRAGResponseCache } from '../application/ports/IRAGResponseCache';
import { TenantPDFResumeRepository } from '@modules/tenant/infrastructure/persistence/repositories/TenantPDFResumeRepository';

jest.mock('axios');
jest.mock('pdf-parse', () => jest.fn());
jest.mock('@shared/infrastructure/observability/DomainTrace', () => ({
  traceAsync: (_name: string, _attrs: any, fn: () => Promise<any>) => fn(),
}));

const mockPdfParse = require('pdf-parse') as jest.Mock;

describe('ProcessDocumentForRAGUseCase', () => {
  let useCase: ProcessDocumentForRAGUseCase;
  let chunkingService: jest.Mocked<DocumentChunkingService>;
  let embeddingProvider: jest.Mocked<IEmbeddingProvider>;
  let chunkRepository: jest.Mocked<IDocumentChunkRepository>;
  let pdfResumeRepository: jest.Mocked<TenantPDFResumeRepository>;
  let ragResponseCache: jest.Mocked<IRAGResponseCache>;

  const input = {
    tenantId: 'tenant-1',
    documentId: 'doc-1',
    fileUrl: 'https://storage.example.com/doc.pdf',
    fileName: 'manual.pdf',
  };

  const makeChunks = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      index: i,
      content: `Chunk content ${i}`,
      tokenCount: 10,
    }));

  beforeEach(() => {
    chunkingService = { chunk: jest.fn().mockReturnValue(makeChunks(2)) } as any;

    embeddingProvider = {
      generateEmbedding: jest.fn(),
      generateEmbeddings: jest.fn().mockResolvedValue([[0.1, 0.2], [0.3, 0.4]]),
    };

    chunkRepository = {
      saveChunks: jest.fn().mockResolvedValue(undefined),
      findSimilar: jest.fn(),
      deleteByDocument: jest.fn().mockResolvedValue(undefined),
      countByDocument: jest.fn(),
    };

    pdfResumeRepository = {
      updateStatus: jest.fn().mockResolvedValue(undefined),
    } as any;

    ragResponseCache = {
      findSimilarResponse: jest.fn(),
      cacheResponse: jest.fn(),
      invalidateTenant: jest.fn().mockResolvedValue(undefined),
    };

    (axios.get as jest.Mock).mockResolvedValue({ data: Buffer.from('fake-pdf-bytes') });
    mockPdfParse.mockResolvedValue({ text: 'Extracted PDF content for processing.' });

    useCase = new ProcessDocumentForRAGUseCase(
      chunkingService,
      embeddingProvider,
      chunkRepository,
      pdfResumeRepository,
      ragResponseCache,
    );
  });

  describe('happy path', () => {
    it('transitions through EXTRACTING → CHUNKING → EMBEDDING → READY', async () => {
      await useCase.execute(input);

      const statuses = (pdfResumeRepository.updateStatus as jest.Mock).mock.calls.map(
        (c) => c[1],
      );
      expect(statuses).toEqual(['EXTRACTING', 'CHUNKING', 'EMBEDDING', 'READY']);
    });

    it('deletes old chunks before saving new ones', async () => {
      await useCase.execute(input);
      expect(chunkRepository.deleteByDocument).toHaveBeenCalledWith('doc-1');
    });

    it('generates embeddings for all chunk contents', async () => {
      await useCase.execute(input);
      expect(embeddingProvider.generateEmbeddings).toHaveBeenCalledWith([
        'Chunk content 0',
        'Chunk content 1',
      ]);
    });

    it('saves chunks with tenantId, documentId, embedding, and fileName metadata', async () => {
      await useCase.execute(input);

      const saved = (chunkRepository.saveChunks as jest.Mock).mock.calls[0][0];
      expect(saved[0]).toMatchObject({
        tenantId: 'tenant-1',
        documentId: 'doc-1',
        chunkIndex: 0,
        content: 'Chunk content 0',
        metadata: { fileName: 'manual.pdf', chunkIndex: 0 },
        embedding: [0.1, 0.2],
      });
    });

    it('invalidates RAG cache for the tenant after saving', async () => {
      await useCase.execute(input);
      expect(ragResponseCache.invalidateTenant).toHaveBeenCalledWith('tenant-1');
    });
  });

  describe('early-exit on invalid content', () => {
    it('sets ERROR when PDF has no extractable text', async () => {
      mockPdfParse.mockResolvedValue({ text: '   ' });

      await useCase.execute(input);

      expect(pdfResumeRepository.updateStatus).toHaveBeenCalledWith(
        'doc-1',
        'ERROR',
        'PDF sem texto extraível',
      );
      expect(embeddingProvider.generateEmbeddings).not.toHaveBeenCalled();
    });

    it('sets ERROR when chunking produces no chunks', async () => {
      chunkingService.chunk.mockReturnValue([]);

      await useCase.execute(input);

      expect(pdfResumeRepository.updateStatus).toHaveBeenCalledWith(
        'doc-1',
        'ERROR',
        'Nenhum chunk gerado',
      );
      expect(chunkRepository.deleteByDocument).not.toHaveBeenCalled();
    });
  });

  describe('error recovery', () => {
    it('sets ERROR with message when PDF download fails', async () => {
      (axios.get as jest.Mock).mockRejectedValue(new Error('Network timeout'));

      await useCase.execute(input);

      expect(pdfResumeRepository.updateStatus).toHaveBeenCalledWith(
        'doc-1',
        'ERROR',
        'Network timeout',
      );
      expect(embeddingProvider.generateEmbeddings).not.toHaveBeenCalled();
    });

    it('sets ERROR when embedding provider fails', async () => {
      embeddingProvider.generateEmbeddings.mockRejectedValue(
        new Error('Embedding generation failed: 429'),
      );

      await useCase.execute(input);

      expect(pdfResumeRepository.updateStatus).toHaveBeenCalledWith(
        'doc-1',
        'ERROR',
        'Embedding generation failed: 429',
      );
    });

    it('truncates error message to 500 chars', async () => {
      const longMessage = 'X'.repeat(600);
      (axios.get as jest.Mock).mockRejectedValue(new Error(longMessage));

      await useCase.execute(input);

      const errorArg = (pdfResumeRepository.updateStatus as jest.Mock).mock.calls.find(
        (c) => c[1] === 'ERROR',
      )?.[2];
      expect(errorArg).toHaveLength(500);
    });
  });

  describe('optional ragResponseCache', () => {
    it('completes successfully without cache and does not throw', async () => {
      const useCaseNoCache = new ProcessDocumentForRAGUseCase(
        chunkingService,
        embeddingProvider,
        chunkRepository,
        pdfResumeRepository,
      );

      await useCaseNoCache.execute(input);

      expect(pdfResumeRepository.updateStatus).toHaveBeenCalledWith('doc-1', 'READY', null);
      expect(ragResponseCache.invalidateTenant).not.toHaveBeenCalled();
    });
  });

  describe('large document batching', () => {
    it('batches embeddings in groups of 100 and saves each batch', async () => {
      chunkingService.chunk.mockReturnValue(makeChunks(150));
      embeddingProvider.generateEmbeddings
        .mockResolvedValueOnce(Array.from({ length: 100 }, () => [0.1]))
        .mockResolvedValueOnce(Array.from({ length: 50 }, () => [0.2]));

      await useCase.execute(input);

      expect(embeddingProvider.generateEmbeddings).toHaveBeenCalledTimes(2);
      expect(chunkRepository.saveChunks).toHaveBeenCalledTimes(2);
      expect(pdfResumeRepository.updateStatus).toHaveBeenCalledWith('doc-1', 'READY', null);
    });

    it('first batch has 100 texts, second has remainder', async () => {
      chunkingService.chunk.mockReturnValue(makeChunks(130));
      embeddingProvider.generateEmbeddings
        .mockResolvedValueOnce(Array.from({ length: 100 }, () => [0.1]))
        .mockResolvedValueOnce(Array.from({ length: 30 }, () => [0.2]));

      await useCase.execute(input);

      const firstBatchTexts = (embeddingProvider.generateEmbeddings as jest.Mock).mock.calls[0][0];
      const secondBatchTexts = (embeddingProvider.generateEmbeddings as jest.Mock).mock.calls[1][0];
      expect(firstBatchTexts).toHaveLength(100);
      expect(secondBatchTexts).toHaveLength(30);
    });
  });
});
