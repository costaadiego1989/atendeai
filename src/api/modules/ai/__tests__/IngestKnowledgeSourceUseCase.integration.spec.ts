import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { IngestKnowledgeSourceUseCase } from '../application/use-cases/knowledge-base/IngestKnowledgeSourceUseCase';
import {
  IEmbeddingProvider,
  EMBEDDING_PROVIDER,
} from '../application/ports/IEmbeddingProvider';

describe('IngestKnowledgeSourceUseCase (integration)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let ingestUseCase: IngestKnowledgeSourceUseCase;
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
    ingestUseCase = app.get(IngestKnowledgeSourceUseCase);
    const embeddingProvider = app.get<IEmbeddingProvider>(EMBEDDING_PROVIDER);

    // Check if embedding provider is available
    try {
      await embeddingProvider.generateEmbeddings(['test']);
    } catch {
      embeddingsAvailable = false;
    }

    // Create test tenant
    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Ingest Integration Test',
        cnpj: `ig${Date.now()}`.slice(-14),
        plan: 'ESSENCIAL',
      },
    });
    tenantId = tenant.id;

    // Create a knowledge source
    const source = await prisma.knowledgeSource.create({
      data: {
        tenantId,
        name: 'Test Webpage Source',
        type: 'webpage',
        sourceUrl: 'https://httpbin.org/html',
        status: 'PENDING',
      },
    });
    sourceId = source.id;
  });

  afterAll(async () => {
    await prisma.tenantDocumentChunk.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.knowledgeSource.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    await app.close();
  });

  it('should ingest a real webpage and create chunks', async () => {
    if (!embeddingsAvailable) {
      console.warn('[SKIPPED] Embedding provider unavailable (quota/config)');
      return;
    }

    const result = await ingestUseCase.execute({
      tenantId,
      sourceId,
      sourceType: 'webpage',
      sourceUrl: 'https://httpbin.org/html',
      sourceName: 'Test Webpage Source',
    });

    expect(result.success).toBe(true);
    expect(result.chunksCreated).toBeGreaterThan(0);
    expect(result.contentHash).toBeDefined();
    expect(result.contentHash!.length).toBe(64); // SHA-256 hex

    // Verify source status was updated
    const source = await prisma.knowledgeSource.findUnique({ where: { id: sourceId } });
    expect(source!.status).toBe('ACTIVE');
    expect(source!.contentHash).toBe(result.contentHash);
    expect(source!.lastSyncAt).not.toBeNull();
  });

  it('should skip re-ingestion when content has not changed', async () => {
    if (!embeddingsAvailable) {
      console.warn('[SKIPPED] Embedding provider unavailable (quota/config)');
      return;
    }

    const result = await ingestUseCase.execute({
      tenantId,
      sourceId,
      sourceType: 'webpage',
      sourceUrl: 'https://httpbin.org/html',
      sourceName: 'Test Webpage Source',
    });

    // Content hash should match, so no new chunks created
    expect(result.success).toBe(true);
    expect(result.chunksCreated).toBe(0);
  });

  it('should handle ingestion failure gracefully', async () => {
    // Create a source with an unreachable URL
    const badSource = await prisma.knowledgeSource.create({
      data: {
        tenantId,
        name: 'Bad Source',
        type: 'webpage',
        sourceUrl: 'https://this-domain-does-not-exist-atendeai-test.invalid/page',
        status: 'PENDING',
      },
    });

    const result = await ingestUseCase.execute({
      tenantId,
      sourceId: badSource.id,
      sourceType: 'webpage',
      sourceUrl: 'https://this-domain-does-not-exist-atendeai-test.invalid/page',
      sourceName: 'Bad Source',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();

    // Verify source status was set to ERROR
    const source = await prisma.knowledgeSource.findUnique({ where: { id: badSource.id } });
    expect(source!.status).toBe('ERROR');
  });

  it('should return error for unsupported source type', async () => {
    const result = await ingestUseCase.execute({
      tenantId,
      sourceId,
      sourceType: 'pdf' as any,
      sourceUrl: 'https://example.com/file.pdf',
      sourceName: 'PDF File',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unsupported source type');
  });
});
