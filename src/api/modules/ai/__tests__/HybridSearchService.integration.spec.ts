import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { HybridSearchService } from '../application/use-cases/knowledge-base/HybridSearchService';
import {
  IDocumentChunkRepository,
  DOCUMENT_CHUNK_REPOSITORY,
} from '../application/ports/IDocumentChunkRepository';
import {
  IEmbeddingProvider,
  EMBEDDING_PROVIDER,
} from '../application/ports/IEmbeddingProvider';

describe('HybridSearchService (integration)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let searchService: HybridSearchService;
  let chunkRepo: IDocumentChunkRepository;
  let embeddingProvider: IEmbeddingProvider;
  let tenantId: string;
  let sourceId: string;
  let embeddingsAvailable = true;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    searchService = app.get(HybridSearchService);
    chunkRepo = app.get<IDocumentChunkRepository>(DOCUMENT_CHUNK_REPOSITORY);
    embeddingProvider = app.get<IEmbeddingProvider>(EMBEDDING_PROVIDER);

    // Create test tenant
    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'KB Integration Test',
        cnpj: `kb${Date.now()}`.slice(-14),
        plan: 'ESSENCIAL',
      },
    });
    tenantId = tenant.id;

    // Create a document record (tenant_pdf_resumes is the parent for chunks FK)
    const doc = await prisma.tenantPDFResume.create({
      data: {
        tenantId,
        fileName: 'integration-test-source.pdf',
        status: 'COMPLETED',
      },
    });
    sourceId = doc.id;

    // Check if embedding provider is available
    try {
      await embeddingProvider.generateEmbeddings(['test']);
    } catch {
      embeddingsAvailable = false;
    }
  });

  afterAll(async () => {
    await prisma.tenantDocumentChunk.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.tenantPDFResume.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    await app.close();
  });

  it('should save chunks and retrieve via countByDocument', async () => {
    const texts = [
      'O sistema de pagamentos aceita PIX, boleto e cartão de crédito.',
      'Para configurar o horário de atendimento, acesse Configurações > Horários.',
      'O plano Essencial inclui até 5 atendentes simultâneos.',
    ];

    // Use dummy embeddings if provider is unavailable
    const embeddings = texts.map(() =>
      Array.from({ length: 1536 }, () => Math.random() * 2 - 1),
    );

    await chunkRepo.saveChunks(
      texts.map((text, idx) => ({
        tenantId,
        documentId: sourceId,
        chunkIndex: idx,
        content: text,
        tokenCount: text.split(' ').length,
        embedding: embeddings[idx],
        metadata: {
          sourceTitle: 'Integration Test Source',
          sourceType: 'webpage',
          sourceUrl: 'https://example.com/test',
          section: `Section ${idx + 1}`,
        },
      })),
    );

    // Verify chunks were saved
    const count = await chunkRepo.countByDocument(sourceId);
    expect(count).toBe(3);
  });

  it('should perform hybrid search and return results', async () => {
    if (!embeddingsAvailable) {
      // HybridSearchService.search() requires embedding provider for query vectorization
      console.warn('[SKIPPED] Embedding provider unavailable (quota/config)');
      return;
    }

    const result = await searchService.search({
      tenantId,
      query: 'pagamento PIX boleto',
      topK: 3,
    });

    // Should return a result structure regardless
    expect(result).toHaveProperty('context');
    expect(result).toHaveProperty('citations');
    expect(Array.isArray(result.citations)).toBe(true);
  });

  it('should scope search to tenant (no cross-tenant leakage)', async () => {
    if (!embeddingsAvailable) {
      console.warn('[SKIPPED] Embedding provider unavailable (quota/config)');
      return;
    }

    const result = await searchService.search({
      tenantId: '00000000-0000-0000-0000-000000000000',
      query: 'pagamento PIX',
      topK: 5,
    });

    // Should not find chunks from our test tenant
    expect(result.citations.every((c) => c.sourceId !== sourceId)).toBe(true);
  });

  it('should delete chunks by document', async () => {
    await chunkRepo.deleteByDocument(sourceId);
    const count = await chunkRepo.countByDocument(sourceId);
    expect(count).toBe(0);
  });
});
