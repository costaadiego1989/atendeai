import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import {
  IRefreshSessionStore,
  REFRESH_SESSION_STORE,
} from '../../application/ports/IRefreshSessionStore';
import { REDIS_CLIENT } from '@shared/infrastructure/redis/RedisModule';

@Injectable()
export class RedisRefreshSessionStore implements IRefreshSessionStore {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async save(
    userId: string,
    sessionId: string,
    ttlSeconds: number,
  ): Promise<void> {
    await this.redis.set(this.getKey(userId), sessionId, 'EX', ttlSeconds);
  }

  async isValid(userId: string, sessionId: string): Promise<boolean> {
    const activeSessionId = await this.redis.get(this.getKey(userId));
    return activeSessionId === sessionId;
  }

  async revoke(userId: string): Promise<void> {
    await this.redis.del(this.getKey(userId));
  }

  private getKey(userId: string): string {
    return `auth:refresh-session:${userId}`;
  }
}
