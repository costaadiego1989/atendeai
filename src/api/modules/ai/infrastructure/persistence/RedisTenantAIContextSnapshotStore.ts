import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@shared/infrastructure/redis/RedisModule';
import {
  ITenantAIContextSnapshotStore,
  TenantAIContextSnapshot,
} from '../../application/ports/ITenantAIContextSnapshot';

@Injectable()
export class RedisTenantAIContextSnapshotStore implements ITenantAIContextSnapshotStore {
  private readonly TTL = 86400; // 24h in seconds
  private readonly PREFIX = 'ai:context:snapshot:';

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async get(tenantId: string): Promise<TenantAIContextSnapshot | null> {
    const key = this.getKey(tenantId);
    const data = await this.redis.get(key);
    if (!data) {
      return null;
    }
    const parsed = JSON.parse(data);
    return {
      ...parsed,
      generatedAt: new Date(parsed.generatedAt),
    };
  }

  async set(
    tenantId: string,
    snapshot: TenantAIContextSnapshot,
  ): Promise<void> {
    const key = this.getKey(tenantId);
    await this.redis.set(key, JSON.stringify(snapshot), 'EX', this.TTL);
  }

  async delete(tenantId: string): Promise<void> {
    const key = this.getKey(tenantId);
    await this.redis.del(key);
  }

  private getKey(tenantId: string): string {
    return `${this.PREFIX}${tenantId}`;
  }
}
