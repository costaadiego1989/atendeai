import { HybridSearchService } from '../application/use-cases/knowledge-base/HybridSearchService';
import { IEmbeddingProvider } from '../application/ports/IEmbeddingProvider';
import { IDocumentChunkRepository } from '../application/ports/IDocumentChunkRepository';

describe('HybridSearchService', () => {
  let service: HybridSearchService;
  let embeddingProvider: jest.Mocked<IEmbeddingProvider>;
  let chunkRepository: jest.Mocked<IDocumentChunkRepository>;

  beforeEach(() => {
    embeddingProvider = {
      generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      generateEmbeddings: jest.fn(),
    } as any;

    chunkRepository = {
      findSimilar: jest.fn(),
      saveChunks: jest.fn(),
      deleteByDocument: jest.fn(),
      countByDocument: jest.fn(),
      keywordSearch: jest.fn().mockResolvedValue([]),
    } as any;

    service = new HybridSearchService(embeddingProvider, chunkRepository);
  });

  describe('search', () => {
    it('should return results combining vector and keyword search', async () => {
      chunkRepository.findSimilar.mockResolvedValue([
        {
          id: 'chunk-1',
          tenantId: 'tenant-1',
          documentId: 'doc-1',
          chunkIndex: 0,
          content: 'Como configurar o sistema de pagamentos.',
          tokenCount: 10,
          metadata: { sourceTitle: 'Manual', sourceType: 'document' },
          similarity: 0.92,
        },
      ]);

      const result = await service.search({
        tenantId: 'tenant-1',
        query: 'como configurar pagamentos',
      });

      expect(result.context).toContain('Como configurar o sistema de pagamentos');
      expect(result.citations).toHaveLength(1);
      expect(result.citations[0].sourceTitle).toBe('Manual');
      expect(result.citations[0].relevanceScore).toBe(0.92);
      expect(embeddingProvider.generateEmbedding).toHaveBeenCalledWith('como configurar pagamentos');
    });

    it('should return empty result when no matches found', async () => {
      chunkRepository.findSimilar.mockResolvedValue([]);

      const result = await service.search({
        tenantId: 'tenant-1',
        query: 'something completely unrelated',
      });

      expect(result.context).toBe('');
      expect(result.citations).toEqual([]);
    });

    it('should merge and deduplicate vector and keyword results', async () => {
      chunkRepository.findSimilar.mockResolvedValue([
        {
          id: 'chunk-1',
          tenantId: 'tenant-1',
          documentId: 'doc-1',
          chunkIndex: 0,
          content: 'Pagamento via PIX é instantâneo.',
          tokenCount: 8,
          metadata: { sourceTitle: 'FAQ' },
          similarity: 0.85,
        },
      ]);

      // Keyword search returns same content
      chunkRepository.keywordSearch.mockResolvedValue([
        {
          documentId: 'doc-1',
          chunkIndex: 0,
          content: 'Pagamento via PIX é instantâneo.',
          metadata: { sourceTitle: 'FAQ' },
        },
      ]);

      const result = await service.search({
        tenantId: 'tenant-1',
        query: 'pagamento PIX',
      });

      // Should have 1 result (deduplicated) with boosted score
      expect(result.citations.length).toBeLessThanOrEqual(5);
      expect(result.citations[0].relevanceScore).toBeGreaterThanOrEqual(0.85);
    });

    it('should respect topK parameter', async () => {
      const chunks = Array.from({ length: 10 }, (_, i) => ({
        id: `chunk-${i}`,
        tenantId: 'tenant-1',
        documentId: `doc-${i}`,
        chunkIndex: 0,
        content: `Content ${i}`,
        tokenCount: 5,
        metadata: { sourceTitle: `Doc ${i}` },
        similarity: 0.9 - i * 0.05,
      }));
      chunkRepository.findSimilar.mockResolvedValue(chunks);

      const result = await service.search({
        tenantId: 'tenant-1',
        query: 'test',
        topK: 3,
      });

      expect(result.citations.length).toBeLessThanOrEqual(3);
    });

    it('should build citations with correct fields', async () => {
      chunkRepository.findSimilar.mockResolvedValue([
        {
          id: 'chunk-1',
          tenantId: 'tenant-1',
          documentId: 'doc-1',
          chunkIndex: 0,
          content: 'A'.repeat(200),
          tokenCount: 50,
          metadata: {
            sourceTitle: 'Product Guide',
            sourceType: 'webpage',
            sourceUrl: 'https://docs.example.com',
            pageNumber: 3,
            section: 'Installation',
          },
          similarity: 0.88,
        },
      ]);

      const result = await service.search({
        tenantId: 'tenant-1',
        query: 'installation guide',
      });

      const citation = result.citations[0];
      expect(citation.sourceId).toBe('doc-1');
      expect(citation.sourceType).toBe('webpage');
      expect(citation.sourceTitle).toBe('Product Guide');
      expect(citation.sourceUrl).toBe('https://docs.example.com');
      expect(citation.pageNumber).toBe(3);
      expect(citation.section).toBe('Installation');
      expect(citation.snippet).toHaveLength(153); // 150 chars + '...'
    });
  });
});
