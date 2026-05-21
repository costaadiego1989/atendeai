import { PrismaDocumentChunkRepository } from '../infrastructure/persistence/PrismaDocumentChunkRepository';
import { SaveChunkInput } from '../application/ports/IDocumentChunkRepository';

describe('PrismaDocumentChunkRepository', () => {
  let repo: PrismaDocumentChunkRepository;
  let prisma: { $executeRaw: jest.Mock; $queryRaw: jest.Mock };

  beforeEach(() => {
    prisma = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    repo = new PrismaDocumentChunkRepository(prisma as any);
  });

  const makeChunk = (overrides: Partial<SaveChunkInput> = {}): SaveChunkInput => ({
    tenantId: 'tenant-1',
    documentId: 'doc-1',
    chunkIndex: 0,
    content: 'Test content',
    tokenCount: 5,
    metadata: { source: 'test' },
    embedding: [0.1, 0.2, 0.3],
    ...overrides,
  });

  describe('saveChunks', () => {
    it('skips DB call for empty array', async () => {
      await repo.saveChunks([]);
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('calls $executeRaw once for a single chunk', async () => {
      await repo.saveChunks([makeChunk()]);
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    });

    it('calls $executeRaw once for exactly 50 chunks (one full batch)', async () => {
      const chunks = Array.from({ length: 50 }, (_, i) => makeChunk({ chunkIndex: i }));
      await repo.saveChunks(chunks);
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    });

    it('splits 60 chunks into 2 batches: 50 + 10', async () => {
      const chunks = Array.from({ length: 60 }, (_, i) => makeChunk({ chunkIndex: i }));
      await repo.saveChunks(chunks);
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
    });

    it('splits 101 chunks into 3 batches: 50 + 50 + 1', async () => {
      const chunks = Array.from({ length: 101 }, (_, i) => makeChunk({ chunkIndex: i }));
      await repo.saveChunks(chunks);
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(3);
    });
  });

  describe('findSimilar', () => {
    const queryEmbedding = [1, 0, 0];

    const makeRow = (overrides: Record<string, unknown> = {}) => ({
      id: 'chunk-1',
      tenant_id: 'tenant-1',
      document_id: 'doc-1',
      chunk_index: 0,
      content: 'Test content',
      token_count: 5,
      metadata: {},
      embedding: [1, 0, 0],
      file_name: null,
      ...overrides,
    });

    it('returns [] when DB returns no rows', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      const result = await repo.findSimilar('tenant-1', queryEmbedding, 5, 0.8);
      expect(result).toEqual([]);
    });

    it('returns only chunks at or above similarity threshold', async () => {
      prisma.$queryRaw.mockResolvedValue([
        makeRow({ id: 'high', content: 'High similarity', embedding: [1, 0, 0] }),
        makeRow({ id: 'low', chunk_index: 1, content: 'Low similarity', embedding: [0, 1, 0] }),
      ]);

      const result = await repo.findSimilar('tenant-1', queryEmbedding, 5, 0.9);
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('High similarity');
    });

    it('sorts results by similarity descending', async () => {
      prisma.$queryRaw.mockResolvedValue([
        makeRow({ id: 'medium', content: 'Medium', embedding: [0.9, 0.1, 0] }),
        makeRow({ id: 'perfect', chunk_index: 1, content: 'Perfect', embedding: [1, 0, 0] }),
      ]);

      const result = await repo.findSimilar('tenant-1', queryEmbedding, 5, 0.0);
      expect(result[0].content).toBe('Perfect');
      expect(result[0].similarity).toBeGreaterThan(result[1].similarity);
    });

    it('limits results to topK', async () => {
      prisma.$queryRaw.mockResolvedValue(
        Array.from({ length: 10 }, (_, i) =>
          makeRow({ id: `chunk-${i}`, chunk_index: i }),
        ),
      );

      const result = await repo.findSimilar('tenant-1', queryEmbedding, 3, 0.0);
      expect(result).toHaveLength(3);
    });

    it('skips chunks with empty embedding array', async () => {
      prisma.$queryRaw.mockResolvedValue([
        makeRow({ embedding: [] }),
      ]);

      const result = await repo.findSimilar('tenant-1', queryEmbedding, 5, 0.0);
      expect(result).toHaveLength(0);
    });

    it('maps DB row fields to SimilarChunkResult with correct types', async () => {
      prisma.$queryRaw.mockResolvedValue([
        makeRow({
          id: 42,
          tenant_id: 'ta',
          document_id: 'da',
          chunk_index: 3,
          content: 'Text',
          token_count: BigInt(8),
          metadata: { src: 'manual' },
          embedding: [1, 0, 0],
          file_name: 'file.pdf',
        }),
      ]);

      const result = await repo.findSimilar('ta', queryEmbedding, 5, 0.0);
      expect(result[0]).toMatchObject({
        id: '42',
        tenantId: 'ta',
        documentId: 'da',
        chunkIndex: 3,
        content: 'Text',
        tokenCount: 8,
        fileName: 'file.pdf',
        metadata: { src: 'manual' },
      });
      expect(typeof result[0].similarity).toBe('number');
    });

    it('omits fileName when null in DB', async () => {
      prisma.$queryRaw.mockResolvedValue([makeRow({ file_name: null })]);

      const result = await repo.findSimilar('tenant-1', queryEmbedding, 5, 0.0);
      expect(result[0].fileName).toBeUndefined();
    });

    it('returns similarity 1.0 for identical vectors', async () => {
      prisma.$queryRaw.mockResolvedValue([
        makeRow({ embedding: [1, 0, 0] }),
      ]);

      const result = await repo.findSimilar('tenant-1', [1, 0, 0], 5, 0.0);
      expect(result[0].similarity).toBeCloseTo(1.0);
    });

    it('returns similarity 0.0 for orthogonal vectors', async () => {
      prisma.$queryRaw.mockResolvedValue([
        makeRow({ embedding: [0, 1, 0] }),
      ]);

      const result = await repo.findSimilar('tenant-1', [1, 0, 0], 5, 0.0);
      expect(result[0].similarity).toBeCloseTo(0.0);
    });
  });

  describe('deleteByDocument', () => {
    it('calls $executeRaw once with the document id', async () => {
      await repo.deleteByDocument('doc-xyz');
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    });
  });

  describe('countByDocument', () => {
    it('returns numeric count from BigInt row', async () => {
      prisma.$queryRaw.mockResolvedValue([{ count: BigInt(7) }]);
      expect(await repo.countByDocument('doc-1')).toBe(7);
    });

    it('returns 0 when query returns no rows', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      expect(await repo.countByDocument('doc-1')).toBe(0);
    });

    it('returns 0 when count field is null', async () => {
      prisma.$queryRaw.mockResolvedValue([{ count: null }]);
      expect(await repo.countByDocument('doc-1')).toBe(0);
    });
  });
});
