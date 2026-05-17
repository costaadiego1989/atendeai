import { Injectable, Inject, Optional } from '@nestjs/common';
import {
  ISocialRepository,
  SOCIAL_REPOSITORY,
} from '../../domain/ports/ISocialRepository';
import {
  ISocialPlatformAdapter,
  SOCIAL_PLATFORM_ADAPTER,
} from '../../domain/ports/ISocialPlatformAdapter';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { SocialManualReplySentIntegrationEvent } from '../../domain/events/integration/SocialManualReplySentIntegrationEvent';

@Injectable()
export class ReplyToCommentUseCase {
  constructor(
    @Inject(SOCIAL_REPOSITORY) private readonly repo: ISocialRepository,
    @Inject(SOCIAL_PLATFORM_ADAPTER)
    private readonly adapter: ISocialPlatformAdapter,
    @Optional() @Inject(EVENT_BUS) private readonly eventBus?: IEventBus,
  ) {}

  async execute(input: {
    tenantId: string;
    commentId: string;
    text: string;
    userId?: string;
  }): Promise<{ success: boolean; replyId?: string; error?: string }> {
    const comment = await this.repo.findCommentById(
      input.tenantId,
      input.commentId,
    );
    if (!comment) {
      return { success: false, error: 'Comentário não encontrado' };
    }

    const account = await this.repo.findAccountById(
      input.tenantId,
      comment.socialAccountId,
    );
    if (!account || !account.isActive) {
      return { success: false, error: 'Conta social desconectada ou inválida' };
    }

    const result = await this.adapter.replyToComment(
      account.accessToken,
      comment.externalCommentId,
      input.text,
    );

    const replyId = await this.repo.saveReply(input.tenantId, {
      commentId: input.commentId,
      externalReplyId: result.replyId,
      text: input.text,
      repliedBy: 'HUMAN',
      userId: input.userId,
      status: result.success ? 'SENT' : 'FAILED',
      errorMessage: result.error,
    });

    if (result.success) {
      await this.repo.updateCommentStatus(
        input.tenantId,
        input.commentId,
        'REPLIED',
        new Date(),
      );
      await this.repo.logAudit(input.tenantId, {
        event: 'MANUAL_REPLY_SENT',
        entityId: input.commentId,
        entityType: 'COMMENT',
        platform: comment.platform,
        metadata: {
          userId: input.userId,
          textPreview: input.text.substring(0, 100),
        },
      });
      await this.eventBus?.publish(
        new SocialManualReplySentIntegrationEvent({
          tenantId: input.tenantId,
          commentId: input.commentId,
          replyId,
          userId: input.userId,
          platform: comment.platform,
        }),
      );
    }

    return { success: result.success, replyId, error: result.error };
  }
}
