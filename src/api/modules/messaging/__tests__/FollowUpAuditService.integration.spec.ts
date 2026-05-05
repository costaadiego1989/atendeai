import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { REDIS_CLIENT } from '@shared/infrastructure/redis/RedisModule';
import Redis from 'ioredis';
import { FollowUpAuditService } from '../application/services/FollowUpAuditService';

describe('FollowUpAuditService (integration)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let redis: Redis;
  let service: FollowUpAuditService;
  const conversationId = `followup-audit-${Date.now()}`;
  const key = `messaging:follow-up:audit:${conversationId}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    redis = app.get(REDIS_CLIENT);
    service = app.get(FollowUpAuditService);
  });

  beforeEach(async () => {
    await redis.del(key);
  });

  afterAll(async () => {
    await redis.del(key).catch(() => {});

    if (app) {
      await app.close();
    }
  });

  it('should record, list and sort follow-up audit entries', async () => {
    await redis.lpush(
      key,
      JSON.stringify({
        type: 'TRIGGERED',
        conversationId,
        interval: '12h',
        timestamp: '2026-01-01T12:00:00.000Z',
      }),
    );
    await redis.lpush(
      key,
      JSON.stringify({
        type: 'SCHEDULED',
        conversationId,
        interval: '1h',
        timestamp: '2026-01-01T10:00:00.000Z',
      }),
    );

    const result = await service.list(conversationId);

    expect(result).toEqual([
      expect.objectContaining({
        type: 'SCHEDULED',
        interval: '1h',
      }),
      expect.objectContaining({
        type: 'TRIGGERED',
        interval: '12h',
      }),
    ]);
  });

  it('should trim the audit trail to 100 entries and define a TTL', async () => {
    for (let i = 0; i < 105; i++) {
      await service.record(conversationId, `${i}h`, 'SCHEDULED');
    }

    const total = await redis.llen(key);
    const ttl = await redis.ttl(key);

    expect(total).toBe(100);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60 * 60 * 24 * 30);
  });
});
