import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  ISocialRepository,
  SOCIAL_REPOSITORY,
} from '../../domain/ports/ISocialRepository';
import {
  ISocialPlatformAdapter,
  SOCIAL_PLATFORM_ADAPTER,
} from '../../domain/ports/ISocialPlatformAdapter';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { SocialAutoReplyTriggeredIntegrationEvent } from '../../domain/events/integration/SocialAutoReplyTriggeredIntegrationEvent';
import { Optional } from '@nestjs/common';

export interface DelayedInboxMessageJobData {
  tenantId: string;
  accountId: string;
  recipientId: string;
  text: string;
  mediaAttachments?: Array<{
    type: string;
    url: string;
    caption?: string;
  }>;
  accessToken: string;
  socialAccountId: string;
  platform: string;
  commentId: string;
  ruleId: string;
  recipientUsername?: string;
  pageId: string;
}

@Processor('social-delayed')
export class SocialDelayedJobProcessor extends WorkerHost {
  private readonly logger = new Logger(SocialDelayedJobProcessor.name);

  constructor(
    @Inject(SOCIAL_REPOSITORY) private readonly repo: ISocialRepository,
    @Inject(SOCIAL_PLATFORM_ADAPTER)
    private readonly adapter: ISocialPlatformAdapter,
    @Optional() @Inject(EVENT_BUS) private readonly eventBus?: IEventBus,
  ) {
    super();
  }

  async process(job: Job<DelayedInboxMessageJobData>): Promise<void> {
    if (job.name !== 'send-delayed-inbox-message') {
      return;
    }

    const data = job.data;
    this.logger.log(
      `Processing delayed inbox message for tenant ${data.tenantId}, recipient ${data.recipientId}`,
    );

    try {
      await this.adapter.sendInboxMessage(
        data.accessToken,
        data.recipientId,
        {
          text: data.text,
        },
        data.pageId,
      );

      if (data.mediaAttachments?.length) {
        for (const media of data.mediaAttachments) {
          const content: Record<string, string> = {};
          if (media.type === 'IMAGE') content.imageUrl = media.url;
          else if (media.type === 'VIDEO') content.videoUrl = media.url;
          else if (media.type === 'AUDIO') content.audioUrl = media.url;
          else if (media.type === 'LINK') {
            content.linkUrl = media.url;
            if (media.caption) content.linkTitle = media.caption;
          }

          await this.adapter.sendInboxMessage(
            data.accessToken,
            data.recipientId,
            content,
            data.pageId,
          );
        }
      }

      await this.repo.upsertInboxThread(data.tenantId, {
        socialAccountId: data.socialAccountId,
        platform: data.platform,
        recipientExternalId: data.recipientId,
        recipientUsername: data.recipientUsername || undefined,
        originCommentId: data.commentId,
        lastMessageText: data.text,
      });

      await this.repo.logAudit(data.tenantId, {
        event: 'INBOX_MESSAGE_SENT',
        entityId: data.commentId,
        entityType: 'COMMENT',
        platform: data.platform,
        ruleId: data.ruleId,
        metadata: { recipientUsername: data.recipientUsername },
      });

      await this.eventBus?.publish(
        new SocialAutoReplyTriggeredIntegrationEvent({
          tenantId: data.tenantId,
          commentId: data.commentId,
          ruleId: data.ruleId,
          platform: data.platform,
          action: 'INBOX_DM',
        }),
      );

      this.logger.log(
        `Delayed inbox message sent successfully for comment ${data.commentId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send delayed inbox message for comment ${data.commentId}: ${error.message}`,
      );
      throw error;
    }
  }
}
