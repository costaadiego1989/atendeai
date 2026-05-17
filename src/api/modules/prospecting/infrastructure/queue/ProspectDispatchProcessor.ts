import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import {
  IDispatchNextProspectCampaignExecutionUseCase,
} from '../../application/use-cases/interfaces/IDispatchNextProspectCampaignExecutionUseCase';
import { ProspectDispatchJob } from '../../domain/ports/IProspectDispatchQueue';
import { StructuredLogEmitter } from '@shared/infrastructure/observability/StructuredLogEmitter';
import { parseRedisConnection } from '@shared/infrastructure/redis/redis-connection.helper';

@Injectable()
export class ProspectDispatchProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProspectDispatchProcessor.name);
  private worker: Worker;

  constructor(
    private readonly configService: ConfigService,
    @Inject(IDispatchNextProspectCampaignExecutionUseCase)
    private readonly dispatchNextUseCase: IDispatchNextProspectCampaignExecutionUseCase,
    private readonly structuredLog: StructuredLogEmitter,
  ) {}

  onModuleInit() {
    const connection = parseRedisConnection(this.configService);

    this.worker = new Worker(
      'prospecting-dispatch',
      async (job: Job<ProspectDispatchJob>) => {
        const bullJobId = job.id != null ? String(job.id) : '';

        this.structuredLog.emit({
          level: 'info',
          event: 'prospecting.dispatch.job_started',
          message: 'Worker iniciou dispatch de campanha',
          attributes: {
            campaign_id: job.data.campaignId,
            tenant_id: job.data.tenantId,
            bull_job_id: bullJobId,
          },
        });

        try {
          await this.dispatchNextUseCase.execute({
            tenantId: job.data.tenantId,
            campaignId: job.data.campaignId,
          });

          this.structuredLog.emit({
            level: 'info',
            event: 'prospecting.dispatch.job_completed',
            message: 'Worker concluiu dispatch de campanha',
            attributes: {
              campaign_id: job.data.campaignId,
              tenant_id: job.data.tenantId,
              bull_job_id: bullJobId,
            },
          });
        } catch (err) {
          this.structuredLog.emit({
            level: 'error',
            event: 'prospecting.dispatch.job_failed',
            message:
              err instanceof Error
                ? err.message
                : 'Falha ao executar dispatch de campanha',
            attributes: {
              campaign_id: job.data.campaignId,
              tenant_id: job.data.tenantId,
              bull_job_id: bullJobId,
            },
          });
          throw err;
        }
      },
      {
        connection,
        concurrency: 1,
      },
    );

    this.worker.on('failed', (job, err) => {
      const bullJobId = job?.id != null ? String(job.id) : '';
      this.structuredLog.emit({
        level: 'error',
        event: 'prospecting.dispatch.worker_failed_event',
        message: err.message,
        attributes: {
          bull_job_id: bullJobId,
          campaign_id: job?.data?.campaignId ?? '',
          tenant_id: job?.data?.tenantId ?? '',
        },
      });
      this.logger.error(
        `Prospect dispatch job ${job?.id} failed: ${err.message}`,
      );
    });
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
