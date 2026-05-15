import { RedisRAGResponseCache } from '../infrastructure/persistence/RedisRAGResponseCache';
import { CachedRAGResponse } from '../application/ports/IRAGResponseCache';

describe('RedisRAGResponseCache', () => {
  let cache: RedisRAGResponseCache;
  let mockRedis: Record<string, jest.Mock>;
  const tenantId = 'tenant-123';

  beforeEach(() => {
    mockRedis = {
      lrange: jest.fn().mockResolvedValue([]),
      rpush: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      llen: jest.fn().mockResolvedValue(1),
      lpop: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
    };

    cache = new RedisRAGResponseCache(mockRedis as any, 3600, 100);
  });

  describe('findSimilarResponse', () => {
    it('should return null when no entries exist', async () => {
      mockRedis.lrange.mockResolvedValue([]);

      const result = await cache.findSimilarResponse(
        tenantId,
        [1, 0, 0],
        0.95,
      );

      expect(result).toBeNull();
      expect(mockRedis.lrange).toHaveBeenCalledWith('rag_cache:tenant-123', 0, -1);
    });

    it('should return cached response when similarity exceeds threshold', async () => {
      const embedding = [1, 0, 0];
      const entry: CachedRAGResponse = {
        responseText: 'Cached answer',
        embedding: [1, 0, 0], // identical vector = similarity 1.0
        createdAt: Date.now(),
      };

      mockRedis.lrange.mockResolvedValue([JSON.stringify(entry)]);

      const result = await cache.findSimilarResponse(tenantId, embedding, 0.95);

      expect(result).toBe('Cached answer');
    });

    it('should return null when similarity is below threshold', async () => {
      const queryEmbedding = [1, 0, 0];
      const entry: CachedRAGResponse = {
        responseText: 'Different answer',
        embedding: [0, 1, 0], // orthogonal vector = similarity 0.0
        createdAt: Date.now(),
      };

      mockRedis.lrange.mockResolvedValue([JSON.stringify(entry)]);

      const result = await cache.findSimilarResponse(
        tenantId,
        queryEmbedding,
        0.95,
      );

      expect(result).toBeNull();
    });

    it('should return the best match when multiple entries exist', async () => {
      const queryEmbedding = [1, 0, 0];
      const entries: CachedRAGResponse[] = [
        {
          responseText: 'Good match',
          embedding: [0.99, 0.1, 0], // high similarity
          createdAt: Date.now(),
        },
        {
          responseText: 'Best match',
          embedding: [1, 0, 0], // perfect similarity
          createdAt: Date.now(),
        },
        {
          responseText: 'Poor match',
          embedding: [0.5, 0.5, 0.5], // low similarity
          createdAt: Date.now(),
        },
      ];

      mockRedis.lrange.mockResolvedValue(entries.map((e) => JSON.stringify(e)));

      const result = await cache.findSimilarResponse(
        tenantId,
        queryEmbedding,
        0.95,
      );

      expect(result).toBe('Best match');
    });

    it('should skip expired entries', async () => {
      const queryEmbedding = [1, 0, 0];
      const entry: CachedRAGResponse = {
        responseText: 'Expired answer',
        embedding: [1, 0, 0],
        createdAt: Date.now() - 4000 * 1000, // 4000 seconds ago, TTL is 3600
      };

      mockRedis.lrange.mockResolvedValue([JSON.stringify(entry)]);

      const result = await cache.findSimilarResponse(
        tenantId,
        queryEmbedding,
        0.95,
      );

      expect(result).toBeNull();
    });

    it('should return null on Redis error without throwing', async () => {
      mockRedis.lrange.mockRejectedValue(new Error('Redis connection lost'));

      const result = await cache.findSimilarResponse(
        tenantId,
        [1, 0, 0],
        0.95,
      );

      expect(result).toBeNull();
    });
  });

  describe('cacheResponse', () => {
    it('should store entry in Redis with correct key', async () => {
      const embedding = [1, 0, 0];
      const responseText = 'New response';

      await cache.cacheResponse(tenantId, embedding, responseText);

      expect(mockRedis.rpush).toHaveBeenCalledWith(
        'rag_cache:tenant-123',
        expect.any(String),
      );

      const storedJson = mockRedis.rpush.mock.calls[0][1];
      const stored: CachedRAGResponse = JSON.parse(storedJson);
      expect(stored.responseText).toBe('New response');
      expect(stored.embedding).toEqual([1, 0, 0]);
      expect(stored.createdAt).toBeGreaterThan(0);
    });

    it('should set TTL on the key', async () => {
      await cache.cacheResponse(tenantId, [1, 0, 0], 'response');

      expect(mockRedis.expire).toHaveBeenCalledWith('rag_cache:tenant-123', 3600);
    });

    it('should enforce max entries by removing oldest', async () => {
      mockRedis.llen.mockResolvedValue(105); // exceeds max of 100

      await cache.cacheResponse(tenantId, [1, 0, 0], 'response');

      expect(mockRedis.lpop).toHaveBeenCalledTimes(5);
    });

    it('should not throw on Redis error', async () => {
      mockRedis.rpush.mockRejectedValue(new Error('Redis full'));

      await expect(
        cache.cacheResponse(tenantId, [1, 0, 0], 'response'),
      ).resolves.toBeUndefined();
    });
  });

  describe('invalidateTenant', () => {
    it('should delete the tenant cache key', async () => {
      await cache.invalidateTenant(tenantId);

      expect(mockRedis.del).toHaveBeenCalledWith('rag_cache:tenant-123');
    });

    it('should not throw on Redis error', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis down'));

      await expect(cache.invalidateTenant(tenantId)).resolves.toBeUndefined();
    });
  });

  describe('cosineSimilarity (via findSimilarResponse)', () => {
    it('should correctly identify identical vectors', async () => {
      const embedding = [0.5, 0.3, 0.8, 0.1];
      const entry: CachedRAGResponse = {
        responseText: 'Same vector',
        embedding: [0.5, 0.3, 0.8, 0.1],
        createdAt: Date.now(),
      };

      mockRedis.lrange.mockResolvedValue([JSON.stringify(entry)]);

      const result = await cache.findSimilarResponse(tenantId, embedding, 0.99);
      expect(result).toBe('Same vector');
    });

    it('should handle zero vectors gracefully', async () => {
      const embedding = [0, 0, 0];
      const entry: CachedRAGResponse = {
        responseText: 'Zero vector',
        embedding: [0, 0, 0],
        createdAt: Date.now(),
      };

      mockRedis.lrange.mockResolvedValue([JSON.stringify(entry)]);

      const result = await cache.findSimilarResponse(tenantId, embedding, 0.95);
      expect(result).toBeNull(); // zero vectors have 0 similarity
    });
  });
});
