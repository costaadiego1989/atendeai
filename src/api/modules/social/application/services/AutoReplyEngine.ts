import { Injectable, Inject, Optional } from '@nestjs/common';
import {
  ISocialRepository,
  SOCIAL_REPOSITORY,
} from '../../domain/ports/ISocialRepository';
import {
  ISocialPlatformAdapter,
  SOCIAL_PLATFORM_ADAPTER,
} from '../../domain/ports/ISocialPlatformAdapter';
import {
  ISocialDelayedJobQueue,
  SOCIAL_DELAYED_JOB_QUEUE,
} from '../../domain/ports/ISocialDelayedJobQueue';
import { SocialComment } from '../../domain/entities/SocialComment';
import { SocialAutoReplyRule } from '../../domain/entities/SocialAutoReplyRule';
import { AI_ENGINE, IAIEngine } from '@modules/ai/application/ports/IAIEngine';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { SocialAutoReplyTriggeredIntegrationEvent } from '../../domain/events/integration/SocialAutoReplyTriggeredIntegrationEvent';

@Injectable()
export class AutoReplyEngine {
  constructor(
    @Inject(SOCIAL_REPOSITORY) private readonly repo: ISocialRepository,
    @Inject(SOCIAL_PLATFORM_ADAPTER)
    private readonly adapter: ISocialPlatformAdapter,
    @Inject(SOCIAL_DELAYED_JOB_QUEUE)
    private readonly socialDelayedJobQueue: ISocialDelayedJobQueue,
    @Optional() @Inject(AI_ENGINE) private readonly aiEngine?: IAIEngine,
    @Optional() @Inject(EVENT_BUS) private readonly eventBus?: IEventBus,
  ) {}

  async evaluate(
    comment: SocialComment,
    accessToken: string,
    postExternalId?: string,
  ): Promise<string | null> {
    const rules = await this.repo.listActiveRules(
      comment.tenantId,
      comment.platform,
    );

    for (const rule of rules) {
      if (!rule.matchesComment(comment.text, postExternalId)) {
        continue;
      }

      const withinLimits = await this.checkRateLimits(rule, comment);
      if (!withinLimits) {
        console.log(
          `[AutoReplyEngine] Rule "${rule.name}" matched but rate limited for comment ${comment.id.toValue()}`,
        );
        continue;
      }

      const success = await this.executeActions(rule, comment, accessToken);
      if (success) {
        await this.repo.incrementRuleFired(comment.tenantId, rule.id.toValue());
        await this.repo.logAudit(comment.tenantId, {
          event: 'AUTO_REPLY_TRIGGERED',
          entityId: comment.id.toValue(),
          entityType: 'COMMENT',
          platform: comment.platform,
          ruleId: rule.id.toValue(),
          metadata: {
            ruleName: rule.name,
            commentText: comment.text.substring(0, 100),
          },
        });
        return rule.id.toValue();
      }
    }

    return null;
  }

  private async checkRateLimits(
    rule: SocialAutoReplyRule,
    comment: SocialComment,
  ): Promise<boolean> {
    const { limits } = rule;

    if (limits.maxRepliesPerHour > 0) {
      const count = await this.repo.countRepliesByRuleInLastHour(
        comment.tenantId,
        rule.id.toValue(),
      );
      if (count >= limits.maxRepliesPerHour) return false;
    }

    if (limits.maxRepliesPerPost > 0) {
      const count = await this.repo.countRepliesForPostByRule(
        comment.tenantId,
        rule.id.toValue(),
        comment.postId,
      );
      if (count >= limits.maxRepliesPerPost) return false;
    }

    if (limits.cooldownPerUser > 0 && comment.authorExternalId) {
      const lastReply = await this.repo.findLastReplyToUser(
        comment.tenantId,
        rule.id.toValue(),
        comment.authorExternalId,
      );
      if (lastReply) {
        const cooldownMs = limits.cooldownPerUser * 60 * 1000;
        if (Date.now() - lastReply.getTime() < cooldownMs) return false;
      }
    }

    return true;
  }

  private async executeActions(
    rule: SocialAutoReplyRule,
    comment: SocialComment,
    accessToken: string,
  ): Promise<boolean> {
    const { actions } = rule;
    let didReply = false;

    const account = await this.repo.findAccountById(
      comment.tenantId,
      comment.socialAccountId,
    );
    const pageId = account?.pageId || '';

    if (actions.replyToComment?.enabled) {
      const replyText = await this.resolveReplyText(
        actions.replyToComment,
        comment.text,
      );
      const result = await this.adapter.replyToComment(
        accessToken,
        comment.externalCommentId,
        replyText,
      );

      await this.repo.saveReply(comment.tenantId, {
        commentId: comment.id.toValue(),
        externalReplyId: result.replyId,
        text: replyText,
        repliedBy: 'AI',
        ruleId: rule.id.toValue(),
        status: result.success ? 'SENT' : 'FAILED',
        errorMessage: result.error,
      });

      if (result.success) {
        await this.repo.updateCommentStatus(
          comment.tenantId,
          comment.id.toValue(),
          'AUTO_REPLIED',
          new Date(),
        );
        await this.eventBus?.publish(
          new SocialAutoReplyTriggeredIntegrationEvent({
            tenantId: comment.tenantId,
            commentId: comment.id.toValue(),
            ruleId: rule.id.toValue(),
            platform: comment.platform,
            action: 'COMMENT_REPLY',
          }),
        );
        didReply = true;
      }
    }

    if (actions.sendInboxMessage?.enabled && comment.authorExternalId) {
      const delayMs = (actions.sendInboxMessage.delaySeconds || 0) * 1000;
      const inboxText = await this.resolveReplyText(
        actions.sendInboxMessage,
        comment.text,
      );
      const mediaAttachments = actions.sendInboxMessage.mediaAttachments || [];

      if (delayMs > 0) {
        await this.socialDelayedJobQueue.addDelayedInboxMessage({
          tenantId: comment.tenantId,
          accountId: comment.socialAccountId,
          recipientId: comment.authorExternalId,
          text: inboxText,
          mediaAttachments,
          delayMs,
          accessToken,
          socialAccountId: comment.socialAccountId,
          platform: comment.platform,
          commentId: comment.id.toValue(),
          ruleId: rule.id.toValue(),
          recipientUsername: comment.authorUsername || undefined,
          pageId,
        });
      } else {
        await this.adapter.sendInboxMessage(
          accessToken,
          comment.authorExternalId,
          {
            text: inboxText,
          },
          pageId,
        );

        for (const media of mediaAttachments) {
          const content: Record<string, string> = {};
          if (media.type === 'IMAGE') content.imageUrl = media.url;
          else if (media.type === 'VIDEO') content.videoUrl = media.url;
          else if (media.type === 'AUDIO') content.audioUrl = media.url;
          else if (media.type === 'LINK') {
            content.linkUrl = media.url;
            if (media.caption) content.linkTitle = media.caption;
          }

          await this.adapter.sendInboxMessage(
            accessToken,
            comment.authorExternalId,
            content,
            pageId,
          );
        }

        await this.repo.upsertInboxThread(comment.tenantId, {
          socialAccountId: comment.socialAccountId,
          platform: comment.platform,
          recipientExternalId: comment.authorExternalId,
          recipientUsername: comment.authorUsername || undefined,
          originCommentId: comment.id.toValue(),
          lastMessageText: inboxText,
        });

        await this.repo.logAudit(comment.tenantId, {
          event: 'INBOX_MESSAGE_SENT',
          entityId: comment.id.toValue(),
          entityType: 'COMMENT',
          platform: comment.platform,
          ruleId: rule.id.toValue(),
          metadata: { recipientUsername: comment.authorUsername },
        });

        await this.eventBus?.publish(
          new SocialAutoReplyTriggeredIntegrationEvent({
            tenantId: comment.tenantId,
            commentId: comment.id.toValue(),
            ruleId: rule.id.toValue(),
            platform: comment.platform,
            action: 'INBOX_DM',
          }),
        );
      }

      didReply = true;
    }

    return didReply;
  }

  private async resolveReplyText(
    config: {
      mode: string;
      templates?: string[];
      aiPrompt?: string;
      includeEmoji?: boolean;
      maxLength?: number;
    },
    commentText: string,
  ): Promise<string> {
    if (config.mode === 'TEMPLATE' && config.templates?.length) {
      const randomIdx = Math.floor(Math.random() * config.templates.length);
      return config.templates[randomIdx];
    }

    if (config.mode === 'AI_GENERATED') {
      if (this.aiEngine) {
        try {
          const prompt =
            config.aiPrompt ??
            'Responda de forma amigável e objetiva em português.';
          const content = (
            await this.aiEngine.generateTextResponse({
              systemPrompt: prompt,
              userMessage: commentText,
              maxTokens: 180,
              temperature: 0.4,
            })
          ).trim();
          if (content) return this.limitLength(content, config.maxLength);
        } catch {
          // fallback determinístico abaixo
        }
      }
      const fallback = `Obrigado pelo comentário! ${commentText.includes('?') ? 'Te enviei mais detalhes no direct.' : 'Qualquer dúvida, estamos por aqui.'}`;
      return this.limitLength(fallback, config.maxLength);
    }

    return this.limitLength(
      'Obrigado pelo seu comentário! 😊',
      config.maxLength,
    );
  }

  private limitLength(text: string, maxLength?: number): string {
    if (!maxLength || maxLength <= 0 || text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
  }
}
