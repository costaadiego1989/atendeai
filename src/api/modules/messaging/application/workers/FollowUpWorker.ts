import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
} from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { IEventBus, EVENT_BUS } from '@shared/infrastructure/event-bus';
import { FollowUpJobData } from '../services/FollowUpService';
import { FollowUpTriggeredEvent } from '../events/FollowUpTriggeredEvent';
import { FollowUpAuditService } from '../services/FollowUpAuditService';
import {
  CONVERSATION_INTELLIGENCE_REPOSITORY,
  IConversationIntelligenceRepository,
} from '../../domain/repositories/IConversationIntelligenceRepository';
import { StructuredLogEmitter } from '@shared/infrastructure/observability/StructuredLogEmitter';

@Injectable()
export class FollowUpWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FollowUpWorker.name);
  private worker: Worker;

  constructor(
    private readonly configService: ConfigService,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    private readonly followUpAuditService: FollowUpAuditService,
    @Inject(CONVERSATION_INTELLIGENCE_REPOSITORY)
    private readonly conversationIntelligenceRepository: IConversationIntelligenceRepository,
    private readonly structuredLog: StructuredLogEmitter,
  ) { }

  onModuleInit() {
    this.worker = new Worker(
      'follow-up',
      async (job: Job<FollowUpJobData>) => {
        const queueJobId =
          job.id === undefined || job.id === null
            ? ''
            : typeof job.id === 'string'
              ? job.id
              : String(job.id);

        this.structuredLog.emit({
          level: 'info',
          event: 'messaging.follow_up.job_started',
          message: 'Worker iniciou job de follow-up',
          tenantId: job.data.tenantId,
          attributes: {
            queue_job_id: queueJobId,
            conversation_id: job.data.conversationId,
            contact_id: job.data.contactId,
            follow_up_interval: job.data.interval,
          },
        });

        await this.processFollowUp(job.data);

        this.structuredLog.emit({
          level: 'info',
          event: 'messaging.follow_up.job_completed',
          message: 'Follow-up publicado no event bus',
          tenantId: job.data.tenantId,
          attributes: {
            queue_job_id: queueJobId,
            conversation_id: job.data.conversationId,
            contact_id: job.data.contactId,
            follow_up_interval: job.data.interval,
          },
        });
      },
      {
        connection: {
          host: this.configService.get<string>('REDIS_HOST', 'localhost'),
          port: this.configService.get<number>('REDIS_PORT', 6379),
        },
        concurrency: 10,
      },
    );

    this.worker.on('failed', (job, err) => {
      const queueJobId =
        job?.id === undefined || job?.id === null
          ? ''
          : typeof job.id === 'string'
            ? job.id
            : String(job.id);
      const tenantId = job?.data?.tenantId;
      this.structuredLog.emit({
        level: 'error',
        event: 'messaging.follow_up.worker_failed',
        message: err.message,
        ...(tenantId ? { tenantId } : {}),
        attributes: {
          queue_job_id: queueJobId,
          conversation_id: job?.data?.conversationId ?? '',
          contact_id: job?.data?.contactId ?? '',
          follow_up_interval: job?.data?.interval ?? '',
        },
      });
      this.logger.error(`Follow-up job ${job?.id} failed: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
  }

  private async processFollowUp(data: FollowUpJobData) {
    await this.followUpAuditService.record(
      data.conversationId,
      data.interval,
      'TRIGGERED',
    );

    const intelligenceByConversation =
      await this.conversationIntelligenceRepository.findByConversationIds(
        data.tenantId,
        [data.conversationId],
      );
    const intelligence = intelligenceByConversation[data.conversationId];

    const event = new FollowUpTriggeredEvent({
      conversationId: data.conversationId,
      tenantId: data.tenantId,
      contactId: data.contactId,
      interval: data.interval,
      intelligence: intelligence ? {
        summary: intelligence.summary,
        sentiment: intelligence.sentiment,
        tags: intelligence.tags,
        interests: intelligence.interests,
        nextStep: intelligence.nextStep,
        lossReason: intelligence.lossReason,
      } : undefined,
    });

    await this.eventBus.publish(event);
  }
}
