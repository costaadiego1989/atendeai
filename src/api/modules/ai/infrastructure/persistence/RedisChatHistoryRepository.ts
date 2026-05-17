import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@shared/infrastructure/redis/RedisModule';
import {
  IChatHistoryRepository,
  ChatMessage,
} from '../../application/ports/IChatHistoryRepository';

@Injectable()
export class RedisChatHistoryRepository implements IChatHistoryRepository {
  private readonly TTL = 30 * 24 * 60 * 60; // 30 days in seconds
  private readonly PREFIX = 'chat_history:';

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async getHistory(conversationId: string): Promise<ChatMessage[]> {
    const key = this.getKey(conversationId);
    const data = await this.redis.lrange(key, 0, -1);

    return data.map((item) => {
      const parsed = JSON.parse(item);
      return {
        ...parsed,
        timestamp: new Date(parsed.timestamp),
      };
    });
  }

  async saveMessage(
    conversationId: string,
    message: ChatMessage,
  ): Promise<void> {
    const key = this.getKey(conversationId);
    const serialized = JSON.stringify(message);

    await this.redis.rpush(key, serialized);
    await this.redis.expire(key, this.TTL);
  }

  async clearHistory(conversationId: string): Promise<void> {
    const key = this.getKey(conversationId);
    await this.redis.del(key);
  }

  private getKey(conversationId: string): string {
    return `${this.PREFIX}${conversationId}`;
  }
}
