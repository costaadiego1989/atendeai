import {
  Inject,
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { ProcessOutboundMessageUseCase } from '../../application/use-cases/ProcessOutboundMessageUseCase';
import { buildQueueTelemetry } from '@shared/infrastructure/queue/QueueJobTelemetry';
import { parseRedisConnection } from '@shared/infrastructure/redis/redis-connection.helper';

@Injectable()
export class OutboundMessageProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboundMessageProcessor.name);
  private worker: Worker;

  constructor(
    private readonly configService: ConfigService,
    private readonly processOutboundUseCase: ProcessOutboundMessageUseCase,
  ) {}

  onModuleInit() {
    const connection = parseRedisConnection(this.configService);

    this.worker = new Worker(
      'outbound-messages',
      async (job: Job<{ messageId: string }>) => {
        this.logger.log(
          JSON.stringify(
            buildQueueTelemetry('outbound-messages', job, 'processing', {
              messageId: job.data.messageId,
            }),
          ),
        );
        await this.processOutboundUseCase.execute({
          messageId: job.data.messageId,
          queueJobId:
            job.id === undefined || job.id === null
              ? ''
              : typeof job.id === 'string'
                ? job.id
                : String(job.id),
        });
      },
      {
        connection,
        concurrency: 5,
      },
    );

    this.worker.on('failed', (job, err) => {
      if (!job) return;
      this.logger.error(
        JSON.stringify(
          buildQueueTelemetry('outbound-messages', job, 'failed', {
            error: err.message,
          }),
        ),
      );
    });

    this.worker.on('completed', (job) => {
      this.logger.log(
        JSON.stringify(
          buildQueueTelemetry('outbound-messages', job, 'completed'),
        ),
      );
    });
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
