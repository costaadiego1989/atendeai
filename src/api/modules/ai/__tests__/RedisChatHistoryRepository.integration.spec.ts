import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import {
  CHAT_HISTORY_REPOSITORY,
  IChatHistoryRepository,
} from '../application/ports/IChatHistoryRepository';
import { REDIS_CLIENT } from '@shared/infrastructure/redis/RedisModule';
import Redis from 'ioredis';

describe('RedisChatHistoryRepository (integration)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let redis: Redis;
  let repository: IChatHistoryRepository;
  const conversationId = `ai-history-${Date.now()}`;
  const key = `chat_history:${conversationId}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    redis = app.get(REDIS_CLIENT);
    repository = app.get<IChatHistoryRepository>(CHAT_HISTORY_REPOSITORY);
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

  it('should persist and return the history in chronological order', async () => {
    await repository.saveMessage(conversationId, {
      role: 'user',
      content: 'Primeira mensagem',
      timestamp: new Date('2026-03-20T10:00:00.000Z'),
    });
    await repository.saveMessage(conversationId, {
      role: 'assistant',
      content: 'Segunda mensagem',
      timestamp: new Date('2026-03-20T10:00:05.000Z'),
    });

    const history = await repository.getHistory(conversationId);

    expect(history).toHaveLength(2);
    expect(history[0]).toEqual(
      expect.objectContaining({
        role: 'user',
        content: 'Primeira mensagem',
      }),
    );
    expect(history[1]).toEqual(
      expect.objectContaining({
        role: 'assistant',
        content: 'Segunda mensagem',
      }),
    );
    expect(history[0]?.timestamp).toBeInstanceOf(Date);
    expect(history[1]?.timestamp).toBeInstanceOf(Date);
  });

  it('should clear the stored history', async () => {
    await repository.saveMessage(conversationId, {
      role: 'user',
      content: 'Mensagem temporaria',
      timestamp: new Date(),
    });

    await repository.clearHistory(conversationId);

    await expect(repository.getHistory(conversationId)).resolves.toEqual([]);
  });
});
