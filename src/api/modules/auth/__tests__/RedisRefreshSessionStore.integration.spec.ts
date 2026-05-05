import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import {
  IRefreshSessionStore,
  REFRESH_SESSION_STORE,
} from '../application/ports/IRefreshSessionStore';
import { REDIS_CLIENT } from '@shared/infrastructure/redis/RedisModule';
import Redis from 'ioredis';

describe('RedisRefreshSessionStore (integration)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let redis: Redis;
  let store: IRefreshSessionStore;
  const userId = `refresh-user-${Date.now()}`;
  const key = `auth:refresh-session:${userId}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    redis = app.get(REDIS_CLIENT);
    store = app.get<IRefreshSessionStore>(REFRESH_SESSION_STORE);
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

  it('should save and validate the active session id', async () => {
    await store.save(userId, 'session-1', 60);

    await expect(store.isValid(userId, 'session-1')).resolves.toBe(true);
    await expect(store.isValid(userId, 'other-session')).resolves.toBe(false);
  });

  it('should overwrite the previous active session', async () => {
    await store.save(userId, 'session-1', 60);
    await store.save(userId, 'session-2', 60);

    await expect(store.isValid(userId, 'session-1')).resolves.toBe(false);
    await expect(store.isValid(userId, 'session-2')).resolves.toBe(true);
  });

  it('should revoke the session', async () => {
    await store.save(userId, 'session-1', 60);

    await store.revoke(userId);

    await expect(store.isValid(userId, 'session-1')).resolves.toBe(false);
  });

  it('should expire the session according to the TTL', async () => {
    await store.save(userId, 'session-1', 1);

    await new Promise((resolve) => setTimeout(resolve, 1200));

    await expect(store.isValid(userId, 'session-1')).resolves.toBe(false);
  });
});
