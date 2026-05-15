import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@shared/infrastructure/redis/RedisModule';
import {
  CachedRAGResponse,
  IRAGResponseCache,
} from '../../application/ports/IRAGResponseCache';

const DEFAULT_TTL_SECONDS = 3600;
const DEFAULT_MAX_ENTRIES = 100;

@Injectable()
export class RedisRAGResponseCache implements IRAGResponseCache {
  private readonly logger = new Logger(RedisRAGResponseCache.name);
  private readonly PREFIX = 'rag_cache:';
  private readonly ttlSeconds: number;
  private readonly maxEntries: number;

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    ttlSeconds?: number,
    maxEntries?: number,
  ) {
    this.ttlSeconds = ttlSeconds ?? DEFAULT_TTL_SECONDS;
    this.maxEntries = maxEntries ?? DEFAULT_MAX_ENTRIES;
  }

  async findSimilarResponse(
    tenantId: string,
    queryEmbedding: number[],
    threshold: number,
  ): Promise<string | null> {
    const key = this.getKey(tenantId);

    try {
      const entries = await this.redis.lrange(key, 0, -1);
      if (entries.length === 0) return null;

      let bestSimilarity = -1;
      let bestResponse: string | null = null;

      for (const raw of entries) {
        const entry: CachedRAGResponse = JSON.parse(raw);

        // Skip expired entries (TTL is handled at key level, but check createdAt too)
        if (Date.now() - entry.createdAt > this.ttlSeconds * 1000) {
          continue;
        }

        const similarity = this.cosineSimilarity(queryEmbedding, entry.embedding);
        if (similarity >= threshold && similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestResponse = entry.responseText;
        }
      }

      if (bestResponse) {
        this.logger.debug(
          `[RAGCache] hit tenant=${tenantId} similarity=${bestSimilarity.toFixed(4)}`,
        );
      }

      return bestResponse;
    } catch (error) {
      this.logger.warn(
        `[RAGCache] findSimilarResponse failed tenant=${tenantId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  async cacheResponse(
    tenantId: string,
    queryEmbedding: number[],
    responseText: string,
  ): Promise<void> {
    const key = this.getKey(tenantId);

    try {
      const entry: CachedRAGResponse = {
        responseText,
        embedding: queryEmbedding,
        createdAt: Date.now(),
      };

      await this.redis.rpush(key, JSON.stringify(entry));
      await this.redis.expire(key, this.ttlSeconds);

      // Enforce max entries (LRU: remove oldest when exceeding limit)
      const length = await this.redis.llen(key);
      if (length > this.maxEntries) {
        const excess = length - this.maxEntries;
        for (let i = 0; i < excess; i++) {
          await this.redis.lpop(key);
        }
      }
    } catch (error) {
      this.logger.warn(
        `[RAGCache] cacheResponse failed tenant=${tenantId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async invalidateTenant(tenantId: string): Promise<void> {
    const key = this.getKey(tenantId);
    try {
      await this.redis.del(key);
      this.logger.log(`[RAGCache] invalidated tenant=${tenantId}`);
    } catch (error) {
      this.logger.warn(
        `[RAGCache] invalidateTenant failed tenant=${tenantId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private getKey(tenantId: string): string {
    return `${this.PREFIX}${tenantId}`;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dot / denominator;
  }
}
