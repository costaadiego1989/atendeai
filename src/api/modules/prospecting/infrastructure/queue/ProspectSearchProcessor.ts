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
  IExecuteProspectSearchUseCase,
} from '../../application/use-cases/interfaces/IExecuteProspectSearchUseCase';
import { StructuredLogEmitter } from '@shared/infrastructure/observability/StructuredLogEmitter';
import { parseRedisConnection } from '@shared/infrastructure/redis/redis-connection.helper';

@Injectable()
export class ProspectSearchProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProspectSearchProcessor.name);
  private worker: Worker;

  constructor(
    private readonly configService: ConfigService,
    @Inject(IExecuteProspectSearchUseCase)
    private readonly executeProspectSearchUseCase: IExecuteProspectSearchUseCase,
    private readonly structuredLog: StructuredLogEmitter,
  ) { }

  onModuleInit() {
    const connection = parseRedisConnection(this.configService);

    this.worker = new Worker(
      'prospect-searches',
      async (job: Job<{ searchId: string }>) => {
        const bullJobId =
          typeof job.id === 'string'
            ? job.id
            : job.id !== undefined && job.id !== null
              ? String(job.id)
              : '';

        this.structuredLog.emit({
          level: 'info',
          event: 'prospecting.search.job_started',
          message: 'Worker iniciou execucao de prospect search',
          attributes: {
            search_id: job.data.searchId,
            bull_job_id: bullJobId,
          },
        });

        try {
          await this.executeProspectSearchUseCase.execute({
            searchId: job.data.searchId,
          });

          this.structuredLog.emit({
            level: 'info',
            event: 'prospecting.search.job_completed',
            message: 'Worker concluiu prospect search',
            attributes: {
              search_id: job.data.searchId,
              bull_job_id: bullJobId,
            },
          });

        } catch (err) {
          this.structuredLog.emit({
            level: 'error',
            event: 'prospecting.search.job_failed',
            message:
              err instanceof Error ? err.message : 'Falha ao executar prospect search',
            attributes: {
              search_id: job.data.searchId,
              bull_job_id: bullJobId,
            },
          });
          throw err;
        }
      },
      {
        connection,
        concurrency: 2,
      },
    );

    this.worker.on('failed', (job, err) => {
      const bullJobId =
        job?.id !== undefined && job?.id !== null ? String(job.id) : '';
      this.structuredLog.emit({
        level: 'error',
        event: 'prospecting.search.worker_failed_event',
        message: err.message,
        attributes: {
          bull_job_id: bullJobId,
          search_id: job?.data?.searchId ?? '',
        },
      });
      this.logger.error(
        `Prospect search job ${job?.id} failed: ${err.message}`,
      );
    });
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
