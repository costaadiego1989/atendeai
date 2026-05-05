import { Injectable, Inject, Optional } from '@nestjs/common';
import { ISocialRepository, SOCIAL_REPOSITORY } from '../../domain/ports/ISocialRepository';
import { ISocialPlatformAdapter, SOCIAL_PLATFORM_ADAPTER } from '../../domain/ports/ISocialPlatformAdapter';
import { SocialComment } from '../../domain/entities/SocialComment';
import { AutoReplyEngine } from '../services/AutoReplyEngine';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { SocialCommentReceivedIntegrationEvent } from '../../domain/events/integration/SocialCommentReceivedIntegrationEvent';

export interface ProcessIncomingCommentInput {
  tenantId: string;
  socialAccountId: string;
  platform: string;
  externalPostId: string;
  externalCommentId: string;
  parentCommentId?: string;
  authorExternalId: string;
  authorUsername: string;
  authorName?: string;
  text: string;
  accessToken: string;
}

@Injectable()
export class ProcessIncomingCommentUseCase {
  constructor(
    @Inject(SOCIAL_REPOSITORY) private readonly repo: ISocialRepository,
    @Inject(SOCIAL_PLATFORM_ADAPTER) private readonly _adapter: ISocialPlatformAdapter,
    private readonly autoReplyEngine: AutoReplyEngine,
    @Optional() @Inject(EVENT_BUS) private readonly eventBus?: IEventBus,
  ) { }

  async execute(input: ProcessIncomingCommentInput): Promise<{
    commentId: string;
    autoReplied: boolean;
    ruleId?: string;
  }> {
    const existing = await this.repo.findCommentByExternalId(input.tenantId, input.externalCommentId);
    if (existing) {
      return { commentId: existing.id.toValue(), autoReplied: false };
    }

    const postId = await this.repo.upsertPost(input.tenantId, {
      socialAccountId: input.socialAccountId,
      platform: input.platform,
      externalPostId: input.externalPostId,
    });

    const comment = SocialComment.create({
      tenantId: input.tenantId,
      socialAccountId: input.socialAccountId,
      postId,
      platform: input.platform,
      externalCommentId: input.externalCommentId,
      parentCommentId: input.parentCommentId || null,
      authorExternalId: input.authorExternalId,
      authorUsername: input.authorUsername,
      authorName: input.authorName || null,
      text: input.text,
    });

    await this.repo.saveComment(comment);
    await this.repo.logAudit(input.tenantId, {
      event: 'COMMENT_RECEIVED',
      entityId: comment.id.toValue(),
      entityType: 'COMMENT',
      platform: input.platform,
      metadata: {
        authorUsername: input.authorUsername,
        postId: input.externalPostId,
        textPreview: input.text.substring(0, 100),
      },
    });
    await this.eventBus?.publish(
      new SocialCommentReceivedIntegrationEvent({
        tenantId: input.tenantId,
        commentId: comment.id.toValue(),
        externalCommentId: input.externalCommentId,
        platform: input.platform,
        authorExternalId: input.authorExternalId,
      }),
    );

    const ruleId = await this.autoReplyEngine.evaluate(
      comment,
      input.accessToken,
      input.externalPostId,
    );

    return {
      commentId: comment.id.toValue(),
      autoReplied: !!ruleId,
      ruleId: ruleId || undefined,
    };
  }
}
