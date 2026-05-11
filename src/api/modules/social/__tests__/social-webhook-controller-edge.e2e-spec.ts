import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ProcessIncomingCommentUseCase } from '../application/use-cases/ProcessIncomingCommentUseCase';
import { SOCIAL_REPOSITORY } from '../domain/ports/ISocialRepository';
import { SocialWebhookController } from '../presentation/controllers/SocialWebhookController';

describe('SocialWebhookController edge contracts (e2e)', () => {
  let app: INestApplication;
  const processComment = { execute: jest.fn() };
  const repo = {
    listKnownTenantsByPlatform: jest.fn(),
    findAccountByPlatform: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SocialWebhookController],
      providers: [
        { provide: ProcessIncomingCommentUseCase, useValue: processComment },
        { provide: SOCIAL_REPOSITORY, useValue: repo },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    repo.listKnownTenantsByPlatform.mockResolvedValue([]);
    repo.findAccountByPlatform.mockResolvedValue(null);
    processComment.execute.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await app.close();
  });

  it('SOC-T-010: ignores malformed comment payloads and unsupported fields', async () => {
    await request(app.getHttpServer())
      .post('/social/webhook/meta')
      .send({
        entry: [
          {
            changes: [
              { field: 'likes', value: { id: 'like-1' } },
              { field: 'comments', value: { id: 'comment-without-text' } },
              {
                field: 'comments',
                value: {
                  id: 'comment-without-owner',
                  text: 'preco?',
                  media: { id: 'media-1' },
                },
              },
            ],
          },
        ],
      })
      .expect(200)
      .expect({ status: 'ok' });

    expect(repo.listKnownTenantsByPlatform).not.toHaveBeenCalled();
    expect(processComment.execute).not.toHaveBeenCalled();
  });

  it('SOC-T-011: valid comment for unknown account stays acknowledged but does not process', async () => {
    await request(app.getHttpServer())
      .post('/social/webhook/meta')
      .send({
        entry: [
          {
            changes: [
              {
                field: 'comments',
                value: {
                  id: 'comment-ext-unknown',
                  text: 'qual o preco?',
                  media: { id: 'media-1', owner: { id: 'ig-unknown' } },
                  from: { id: 'author-1', username: 'maria' },
                },
              },
            ],
          },
        ],
      })
      .expect(200)
      .expect({ status: 'ok' });

    expect(repo.listKnownTenantsByPlatform).toHaveBeenCalledWith(
      'INSTAGRAM',
      'ig-unknown',
    );
    expect(repo.findAccountByPlatform).not.toHaveBeenCalled();
    expect(processComment.execute).not.toHaveBeenCalled();
  });

  it('SOC-T-020: dispatches one use case call per known tenant account', async () => {
    repo.listKnownTenantsByPlatform.mockResolvedValue([
      { tenantId: 'tenant-1' },
      { tenantId: 'tenant-2' },
    ]);
    repo.findAccountByPlatform
      .mockResolvedValueOnce({
        id: { toValue: () => 'account-1' },
        accessToken: 'token-1',
      })
      .mockResolvedValueOnce({
        id: { toValue: () => 'account-2' },
        accessToken: 'token-2',
      });

    await request(app.getHttpServer())
      .post('/social/webhook/meta')
      .send({
        entry: [
          {
            changes: [
              {
                field: 'comments',
                value: {
                  id: 'comment-ext-1',
                  text: 'qual o preco?',
                  media: { id: 'media-1', owner: { id: 'ig-owner-1' } },
                  from: { id: 'author-1', username: 'maria' },
                },
              },
            ],
          },
        ],
      })
      .expect(200)
      .expect({ status: 'ok' });

    expect(processComment.execute).toHaveBeenCalledTimes(2);
    expect(processComment.execute).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        tenantId: 'tenant-1',
        socialAccountId: 'account-1',
        externalCommentId: 'comment-ext-1',
        accessToken: 'token-1',
      }),
    );
    expect(processComment.execute).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        tenantId: 'tenant-2',
        socialAccountId: 'account-2',
        externalCommentId: 'comment-ext-1',
        accessToken: 'token-2',
      }),
    );
  });
});
