import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue, Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { FollowUpAuditService } from './FollowUpAuditService';
import { parseRedisConnection } from '@shared/infrastructure/redis/redis-connection.helper';

export interface FollowUpJobData {
  conversationId: string;
  tenantId: string;
  contactId: string;
  interval: string;
}

@Injectable()
export class FollowUpService implements OnModuleDestroy {
  private readonly logger = new Logger(FollowUpService.name);
  private readonly queue: Queue<FollowUpJobData>;

  constructor(
    private readonly configService: ConfigService,
    private readonly followUpAuditService: FollowUpAuditService,
  ) {
    const connection = parseRedisConnection(this.configService);

    this.queue = new Queue('follow-up', { connection });
  }

  async scheduleFollowUps(
    conversationId: string,
    tenantId: string,
    contactId: string,
  ): Promise<void> {
    await this.cancelFollowUps(conversationId, 'rescheduled');

    const intervals = [
      { name: '1h', delay: 1 * 60 * 60 * 1000 },
      { name: '12h', delay: 12 * 60 * 60 * 1000 },
      { name: '1d', delay: 24 * 60 * 60 * 1000 },
      { name: '7d', delay: 7 * 24 * 60 * 60 * 1000 },
    ];

    for (const interval of intervals) {
      await this.queue.add(
        'send-follow-up',
        { conversationId, tenantId, contactId, interval: interval.name },
        {
          delay: interval.delay,
          jobId: `follow-up:${conversationId}:${interval.name}`,
          removeOnComplete: true,
        },
      );
      await this.followUpAuditService.record(
        conversationId,
        interval.name,
        'SCHEDULED',
      );
    }

    this.logger.log(`Scheduled follow-ups for conversation ${conversationId}`);
  }

  async cancelFollowUps(
    conversationId: string,
    reason = 'conversation-updated',
  ): Promise<void> {
    const intervals = ['1h', '12h', '1d', '7d'];
    for (const interval of intervals) {
      const jobId = `follow-up:${conversationId}:${interval}`;
      const job = await this.queue.getJob(jobId);
      if (job) {
        await job.remove();
        await this.followUpAuditService.record(
          conversationId,
          interval,
          'CANCELLED',
          reason,
        );
      }
    }
    this.logger.log(`Cancelled follow-ups for conversation ${conversationId}`);
  }

  async onModuleDestroy() {
    await this.queue.close();
  }
}
