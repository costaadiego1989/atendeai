import { ConfigService } from '@nestjs/config';
import { TenantPDFContextProvider } from '../infrastructure/adapters/TenantPDFContextProvider';
import { IEmbeddingProvider } from '../application/ports/IEmbeddingProvider';
import { IDocumentChunkRepository, SimilarChunkResult } from '../application/ports/IDocumentChunkRepository';
import { TenantPDFResumeRepository } from '@modules/tenant/infrastructure/persistence/repositories/TenantPDFResumeRepository';

describe('TenantPDFContextProvider (RAG)', () => {
  let provider: TenantPDFContextProvider;
  let mockEmbeddingProvider: jest.Mocked<IEmbeddingProvider>;
  let mockChunkRepository: jest.Mocked<IDocumentChunkRepository>;
  let mockPdfResumeRepository: jest.Mocked<TenantPDFResumeRepository>;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    mockEmbeddingProvider = {
      generateEmbedding: jest.fn(),
      generateEmbeddings: jest.fn(),
    };

    mockChunkRepository = {
      saveChunks: jest.fn(),
      findSimilar: jest.fn(),
      deleteByDocument: jest.fn(),
      countByDocument: jest.fn(),
    };

    mockPdfResumeRepository = {
      listReadyWithMeta: jest.fn(),
      listReadySummaries: jest.fn(),
      upsert: jest.fn(),
      listByTenant: jest.fn(),
      updateStatus: jest.fn(),
      findById: jest.fn(),
    } as any;

    mockConfigService = {
      get: jest.fn().mockReturnValue(undefined),
    } as any;

    provider = new TenantPDFContextProvider(
      mockPdfResumeRepository,
      mockEmbeddingProvider,
      mockChunkRepository,
      mockConfigService,
    );
  });

  it('should return RAG context when similar chunks are found', async () => {
    const fakeEmbedding = [0.1, 0.2, 0.3];
    mockEmbeddingProvider.generateEmbedding.mockResolvedValue(fakeEmbedding);

    const chunks: SimilarChunkResult[] = [
      {
        id: 'chunk-1',
        tenantId: 'tenant-1',
        documentId: 'doc-1',
        chunkIndex: 0,
        content: 'Horário de atendimento: segunda a sexta, 8h às 18h.',
        tokenCount: 15,
        metadata: {},
        similarity: 0.85,
        fileName: 'Manual de Atendimento.pdf',
      },
      {
        id: 'chunk-2',
        tenantId: 'tenant-1',
        documentId: 'doc-2',
        chunkIndex: 2,
        content: 'Trocas podem ser realizadas em até 30 dias.',
        tokenCount: 12,
        metadata: {},
        similarity: 0.78,
        fileName: 'Política de Trocas.pdf',
      },
    ];
    mockChunkRepository.findSimilar.mockResolvedValue(chunks);

    const result = await provider.findRelevantPDFContext(
      'tenant-1',
      'Qual o horário de atendimento?',
    );

    expect(result).not.toBeNull();
    expect(result).toContain('BUSCA INTELIGENTE');
    expect(result).toContain('[FONTE: "Manual de Atendimento.pdf", trecho 1]');
    expect(result).toContain('Horário de atendimento');
    expect(result).toContain('[FONTE: "Política de Trocas.pdf", trecho 3]');
    expect(result).toContain('Trocas podem ser realizadas');

    expect(mockEmbeddingProvider.generateEmbedding).toHaveBeenCalledWith(
      'Qual o horário de atendimento?',
    );
    expect(mockChunkRepository.findSimilar).toHaveBeenCalledWith(
      'tenant-1',
      fakeEmbedding,
      5,
      0.7,
    );
  });

  it('should fallback to legacy summaries when no chunks found', async () => {
    mockEmbeddingProvider.generateEmbedding.mockResolvedValue([0.1, 0.2]);
    mockChunkRepository.findSimilar.mockResolvedValue([]);

    mockPdfResumeRepository.listReadyWithMeta.mockResolvedValue([
      {
        fileName: 'Catalogo.pdf',
        fileUrl: 'https://s3.example.com/catalogo.pdf',
        summaries: ['Produto A custa R$50', 'Produto B custa R$100'],
        canSendIt: false,
      },
    ]);

    const result = await provider.findRelevantPDFContext(
      'tenant-1',
      'Quanto custa o produto A?',
    );

    expect(result).not.toBeNull();
    expect(result).toContain('Produto A custa R$50');
    expect(result).not.toContain('BUSCA INTELIGENTE');
  });

  it('should fallback to legacy when embedding provider fails', async () => {
    mockEmbeddingProvider.generateEmbedding.mockRejectedValue(
      new Error('API unavailable'),
    );

    mockPdfResumeRepository.listReadyWithMeta.mockResolvedValue([
      {
        fileName: 'FAQ.pdf',
        fileUrl: null,
        summaries: ['Resposta padrão do FAQ'],
        canSendIt: false,
      },
    ]);

    const result = await provider.findRelevantPDFContext(
      'tenant-1',
      'Pergunta qualquer',
    );

    expect(result).not.toBeNull();
    expect(result).toContain('Resposta padrão do FAQ');
  });

  it('should return null when no chunks and no summaries exist', async () => {
    mockEmbeddingProvider.generateEmbedding.mockResolvedValue([0.1]);
    mockChunkRepository.findSimilar.mockResolvedValue([]);
    mockPdfResumeRepository.listReadyWithMeta.mockResolvedValue([]);

    const result = await provider.findRelevantPDFContext(
      'tenant-1',
      'Qualquer pergunta',
    );

    expect(result).toBeNull();
  });

  it('should include canSendIt document link in legacy fallback', async () => {
    mockEmbeddingProvider.generateEmbedding.mockResolvedValue([0.1]);
    mockChunkRepository.findSimilar.mockResolvedValue([]);

    mockPdfResumeRepository.listReadyWithMeta.mockResolvedValue([
      {
        fileName: 'Contrato.pdf',
        fileUrl: 'https://s3.example.com/contrato.pdf',
        summaries: ['Termos do contrato'],
        canSendIt: true,
      },
    ]);

    const result = await provider.findRelevantPDFContext(
      'tenant-1',
      'Me envia o contrato',
    );

    expect(result).toContain('DOCUMENTO DISPONÍVEL PARA ENVIO');
    expect(result).toContain('https://s3.example.com/contrato.pdf');
  });
});
