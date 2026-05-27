import { AutoReplyEngine } from '../application/services/AutoReplyEngine';
import { SocialAutoReplyRule } from '../domain/entities/SocialAutoReplyRule';
import { SocialComment } from '../domain/entities/SocialComment';

describe('AutoReplyEngine', () => {
  it('deve usar fallback mock quando AI_ENGINE não estiver disponível', async () => {
    const rule = SocialAutoReplyRule.create({
      tenantId: 'tenant-1',
      name: 'Regra com IA',
      platform: 'INSTAGRAM',
      conditions: { keywords: ['preço'] },
      actions: {
        replyToComment: {
          enabled: true,
          mode: 'AI_GENERATED',
          aiPrompt: 'responda amigavelmente',
        },
        sendInboxMessage: {
          enabled: false,
          delaySeconds: 0,
          mode: 'TEMPLATE',
        },
      },
    });

    const comment = SocialComment.create({
      tenantId: 'tenant-1',
      socialAccountId: 'account-1',
      postId: 'post-1',
      platform: 'INSTAGRAM',
      externalCommentId: 'ext-comment-1',
      parentCommentId: null,
      authorExternalId: 'author-1',
      authorUsername: 'maria',
      authorName: 'Maria',
      text: 'qual o preço?',
    });

    const repo = {
      listActiveRules: jest.fn().mockResolvedValue([rule]),
      countRepliesByRuleInLastHour: jest.fn().mockResolvedValue(0),
      countRepliesForPostByRule: jest.fn().mockResolvedValue(0),
      findLastReplyToUser: jest.fn().mockResolvedValue(null),
      findAccountById: jest.fn().mockResolvedValue({ pageId: 'page-123' }),
      saveReply: jest.fn().mockResolvedValue('reply-1'),
      updateCommentStatus: jest.fn().mockResolvedValue(undefined),
      incrementRuleFired: jest.fn().mockResolvedValue(undefined),
      logAudit: jest.fn().mockResolvedValue(undefined),
      upsertInboxThread: jest.fn().mockResolvedValue('thread-1'),
    } as any;

    const adapter = {
      replyToComment: jest.fn().mockResolvedValue({
        success: true,
        replyId: 'external-reply-1',
      }),
      sendInboxMessage: jest.fn().mockResolvedValue({
        success: true,
        messageId: 'message-1',
      }),
    } as any;

    const eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    } as any;

    const delayedJobQueue = { schedule: jest.fn() } as any;
    const sut = new AutoReplyEngine(
      repo,
      adapter,
      delayedJobQueue,
      undefined,
      eventBus,
    );

    const ruleId = await sut.evaluate(comment, 'token-x', 'post-1');

    expect(ruleId).toBe(rule.id.toValue());
    expect(adapter.replyToComment).toHaveBeenCalledTimes(1);
    expect(adapter.replyToComment.mock.calls[0][2]).toContain(
      'Obrigado pelo comentário',
    );
    expect(eventBus.publish).toHaveBeenCalled();
  });
});
