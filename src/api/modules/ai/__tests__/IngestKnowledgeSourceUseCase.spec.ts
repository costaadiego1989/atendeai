import { IngestKnowledgeSourceUseCase } from '../application/use-cases/knowledge-base/IngestKnowledgeSourceUseCase';
import { IEmbeddingProvider } from '../application/ports/IEmbeddingProvider';
import { IDocumentChunkRepository } from '../application/ports/IDocumentChunkRepository';
import { WebCrawlerAdapter } from '../infrastructure/adapters/knowledge-sources/WebCrawlerAdapter';
import { GoogleDriveAdapter } from '../infrastructure/adapters/knowledge-sources/GoogleDriveAdapter';
import { NotionAdapter } from '../infrastructure/adapters/knowledge-sources/NotionAdapter';

describe('IngestKnowledgeSourceUseCase', () => {
  let useCase: IngestKnowledgeSourceUseCase;
  let prisma: any;
  let chunkingService: any;
  let embeddingProvider: jest.Mocked<IEmbeddingProvider>;
  let chunkRepository: jest.Mocked<IDocumentChunkRepository>;
  let webCrawler: jest.Mocked<WebCrawlerAdapter>;
  let googleDrive: jest.Mocked<GoogleDriveAdapter>;
  let notion: jest.Mocked<NotionAdapter>;

  beforeEach(() => {
    prisma = {
      knowledgeSource: {
        update: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ id: 'src-1', contentHash: 'old-hash' }),
      },
    };

    chunkingService = {
      chunk: jest.fn().mockReturnValue([
        { content: 'Chunk 1 content', index: 0, tokenCount: 10 },
        { content: 'Chunk 2 content', index: 1, tokenCount: 12 },
      ]),
    };

    embeddingProvider = {
      generateEmbedding: jest.fn(),
      generateEmbeddings: jest.fn().mockResolvedValue([[0.1, 0.2], [0.3, 0.4]]),
    } as any;

    chunkRepository = {
      saveChunks: jest.fn(),
      findSimilar: jest.fn(),
      deleteByDocument: jest.fn(),
      countByDocument: jest.fn(),
    } as any;

    webCrawler = {
      sourceType: 'webpage',
      ingest: jest.fn(),
    } as any;

    googleDrive = {
      sourceType: 'google-drive',
      ingest: jest.fn(),
    } as any;

    notion = {
      sourceType: 'notion',
      ingest: jest.fn(),
    } as any;

    useCase = new IngestKnowledgeSourceUseCase(
      prisma,
      chunkingService,
      embeddingProvider,
      chunkRepository,
      webCrawler,
      googleDrive,
      notion,
    );
  });

  it('should ingest a webpage source successfully', async () => {
    webCrawler.ingest.mockResolvedValue({
      contents: [{ title: 'FAQ', text: 'Some FAQ content here.', sourceUrl: 'https://example.com/faq' }],
      contentHash: 'new-hash-123',
    });

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      sourceId: 'src-1',
      sourceType: 'webpage',
      sourceUrl: 'https://example.com/faq',
      sourceName: 'FAQ Page',
    });

    expect(result.success).toBe(true);
    expect(result.chunksCreated).toBe(2);
    expect(result.contentHash).toBe('new-hash-123');
    expect(chunkRepository.deleteByDocument).toHaveBeenCalledWith('src-1');
    expect(chunkRepository.saveChunks).toHaveBeenCalled();
    expect(prisma.knowledgeSource.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ACTIVE', contentHash: 'new-hash-123' }),
      }),
    );
  });

  it('should skip re-ingestion when content hash is unchanged', async () => {
    webCrawler.ingest.mockResolvedValue({
      contents: [{ title: 'FAQ', text: 'Same content', sourceUrl: 'https://example.com' }],
      contentHash: 'old-hash', // Same as existing
    });

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      sourceId: 'src-1',
      sourceType: 'webpage',
      sourceUrl: 'https://example.com',
      sourceName: 'FAQ',
    });

    expect(result.success).toBe(true);
    expect(result.chunksCreated).toBe(0);
    expect(chunkRepository.deleteByDocument).not.toHaveBeenCalled();
    expect(chunkRepository.saveChunks).not.toHaveBeenCalled();
  });

  it('should return error for unsupported source type', async () => {
    const result = await useCase.execute({
      tenantId: 'tenant-1',
      sourceId: 'src-1',
      sourceType: 'pdf' as any,
      sourceUrl: 'https://example.com/file.pdf',
      sourceName: 'PDF File',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unsupported source type');
  });

  it('should handle adapter failure gracefully', async () => {
    webCrawler.ingest.mockRejectedValue(new Error('Connection timeout'));

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      sourceId: 'src-1',
      sourceType: 'webpage',
      sourceUrl: 'https://unreachable.com',
      sourceName: 'Broken Page',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Connection timeout');
    expect(prisma.knowledgeSource.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'ERROR' },
      }),
    );
  });

  it('should use google-drive adapter for google-drive source type', async () => {
    googleDrive.ingest.mockResolvedValue({
      contents: [{ title: 'Doc', text: 'Google doc content', sourceUrl: 'https://drive.google.com/...' }],
      contentHash: 'gdrive-hash',
    });

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      sourceId: 'src-1',
      sourceType: 'google-drive',
      sourceUrl: 'https://drive.google.com/file/d/abc123',
      sourceName: 'My Doc',
      credentials: { accessToken: 'token-123' },
    });

    expect(result.success).toBe(true);
    expect(googleDrive.ingest).toHaveBeenCalledWith(
      'https://drive.google.com/file/d/abc123',
      { accessToken: 'token-123' },
    );
  });

  it('should use notion adapter for notion source type', async () => {
    notion.ingest.mockResolvedValue({
      contents: [{ title: 'Notion Page', text: 'Notion content', sourceUrl: 'https://notion.so/...' }],
      contentHash: 'notion-hash',
    });

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      sourceId: 'src-1',
      sourceType: 'notion',
      sourceUrl: 'https://notion.so/page-abc123',
      sourceName: 'My Notion Page',
      credentials: { notionApiKey: 'secret_xxx' },
    });

    expect(result.success).toBe(true);
    expect(notion.ingest).toHaveBeenCalledWith(
      'https://notion.so/page-abc123',
      { notionApiKey: 'secret_xxx' },
    );
  });

  it('should set status to INGESTING before processing', async () => {
    webCrawler.ingest.mockResolvedValue({
      contents: [{ title: 'T', text: 'Content', sourceUrl: 'https://x.com' }],
      contentHash: 'new-hash',
    });

    await useCase.execute({
      tenantId: 'tenant-1',
      sourceId: 'src-1',
      sourceType: 'webpage',
      sourceUrl: 'https://x.com',
      sourceName: 'X',
    });

    // First update should set INGESTING
    expect(prisma.knowledgeSource.update).toHaveBeenNthCalledWith(1,
      expect.objectContaining({ data: { status: 'INGESTING' } }),
    );
  });
});
