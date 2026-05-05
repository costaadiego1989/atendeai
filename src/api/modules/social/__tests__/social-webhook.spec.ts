import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { SocialWebhookController } from '../presentation/controllers/SocialWebhookController';
import { ProcessIncomingCommentUseCase } from '../application/use-cases/ProcessIncomingCommentUseCase';
import { AutoReplyEngine } from '../application/services/AutoReplyEngine';
import { SOCIAL_REPOSITORY } from '../domain/ports/ISocialRepository';
import { SOCIAL_PLATFORM_ADAPTER } from '../domain/ports/ISocialPlatformAdapter';
import { SocialAutoReplyRule } from '../domain/entities/SocialAutoReplyRule';
import { SocialAccount } from '../domain/entities/SocialAccount';
import { UniqueEntityID } from '../../../shared/domain/UniqueEntityID';
import { EVENT_BUS } from '../../../shared/application/ports/IEventBus';

describe('SocialWebhookController', () => {
  let app: INestApplication;
  const audits: string[] = [];
  const publishedEvents: string[] = [];

  const rule = SocialAutoReplyRule.reconstitute(
    {
      tenantId: 'tenant-1',
      name: 'Regra preço',
      isActive: true,
      priority: 10,
      platform: 'INSTAGRAM',
      conditions: { keywords: ['preço'] },
      actions: {
        replyToComment: { enabled: true, mode: 'TEMPLATE', templates: ['Te chamei no direct 😉'] },
        sendInboxMessage: { enabled: true, delaySeconds: 0, mode: 'TEMPLATE', templates: ['Mensagem no DM'] },
      },
      limits: { maxRepliesPerPost: 50, maxRepliesPerHour: 30, cooldownPerUser: 60 },
      totalFired: 0,
      lastFiredAt: null,
    },
    new UniqueEntityID('rule-1'),
  );

  const account = SocialAccount.reconstitute(
    {
      tenantId: 'tenant-1',
      platform: 'INSTAGRAM',
      externalAccountId: 'ig-owner-1',
      username: 'empresa',
      displayName: 'Empresa',
      profilePictureUrl: null,
      accessToken: 'token-1',
      refreshToken: null,
      tokenExpiresAt: null,
      pageId: 'page-1',
      webhookSecret: null,
      status: 'ACTIVE',
      connectedAt: new Date(),
    },
    new UniqueEntityID('account-1'),
  );

  const repo = {
    commentsByExternalId: new Map<string, any>(),
    async findCommentByExternalId(_: string, externalId: string) {
      return this.commentsByExternalId.get(externalId) ?? null;
    },
    async upsertPost() {
      return 'post-1';
    },
    async saveComment(comment: any) {
      this.commentsByExternalId.set(comment.externalCommentId, comment);
    },
    async logAudit(_: string, entry: { event: string }) {
      audits.push(entry.event);
    },
    async listActiveRules() {
      return [rule];
    },
    async countRepliesByRuleInLastHour() {
      return 0;
    },
    async countRepliesForPostByRule() {
      return 0;
    },
    async findLastReplyToUser() {
      return null;
    },
    async saveReply() {
      return 'reply-1';
    },
    async updateCommentStatus() {},
    async incrementRuleFired() {},
    async upsertInboxThread() {
      return 'thread-1';
    },
    async listKnownTenantsByPlatform() {
      return [{ tenantId: 'tenant-1' }];
    },
    async findAccountByPlatform() {
      return account;
    },
  };

  const adapter = {
    replyToComment: jest.fn().mockResolvedValue({ success: true, replyId: 'reply-meta-1' }),
    sendInboxMessage: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-meta-1' }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SocialWebhookController],
      providers: [
        ProcessIncomingCommentUseCase,
        AutoReplyEngine,
        { provide: SOCIAL_REPOSITORY, useValue: repo },
        { provide: SOCIAL_PLATFORM_ADAPTER, useValue: adapter },
        {
          provide: EVENT_BUS,
          useValue: {
            publish: async (event: { constructor: { name: string } }) => {
              publishedEvents.push(event.constructor.name);
            },
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('SOC-T-010: payload sem entry não falha e devolve ok', async () => {
    await request(app.getHttpServer())
      .post('/social/webhook/meta')
      .send({})
      .expect(200)
      .expect({ status: 'ok' });

    expect(adapter.replyToComment).not.toHaveBeenCalled();
  });

  it('processa comentário, dispara automação e emite eventos sem ENV Meta', async () => {
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
                  text: 'qual o preço?',
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

    expect(adapter.replyToComment).toHaveBeenCalled();
    expect(adapter.sendInboxMessage).toHaveBeenCalled();
    expect(audits).toContain('COMMENT_RECEIVED');
    expect(audits).toContain('AUTO_REPLY_TRIGGERED');
    expect(publishedEvents).toContain('SocialCommentReceivedIntegrationEvent');
    expect(publishedEvents).toContain('SocialAutoReplyTriggeredIntegrationEvent');
  });
});

