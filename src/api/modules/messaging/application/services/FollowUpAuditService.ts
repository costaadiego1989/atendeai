import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@shared/infrastructure/redis/RedisModule';

export type FollowUpAuditType =
  | 'SCHEDULED'
  | 'CANCELLED'
  | 'TRIGGERED'
  | 'SKIPPED';

export interface FollowUpAuditEntry {
  type: FollowUpAuditType;
  conversationId: string;
  interval: string;
  reason?: string;
  timestamp: string;
}

@Injectable()
export class FollowUpAuditService {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async record(
    conversationId: string,
    interval: string,
    type: FollowUpAuditType,
    reason?: string,
  ): Promise<void> {
    const key = this.getKey(conversationId);
    const entry: FollowUpAuditEntry = {
      type,
      conversationId,
      interval,
      reason,
      timestamp: new Date().toISOString(),
    };

    await this.redis.lpush(key, JSON.stringify(entry));
    await this.redis.ltrim(key, 0, 99);
    await this.redis.expire(key, 60 * 60 * 24 * 30);
  }

  async list(conversationId: string): Promise<FollowUpAuditEntry[]> {
    const entries = await this.redis.lrange(this.getKey(conversationId), 0, 99);

    return entries
      .map((entry) => JSON.parse(entry) as FollowUpAuditEntry)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  private getKey(conversationId: string): string {
    return `messaging:follow-up:audit:${conversationId}`;
  }
}
