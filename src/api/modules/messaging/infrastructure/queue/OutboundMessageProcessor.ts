import {
  Inject,
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { ProcessOutboundMessageUseCase } from '../../application/use-cases/ProcessOutboundMessageUseCase';
import { buildQueueTelemetry } from '@shared/infrastructure/queue/QueueJobTelemetry';
import { parseRedisConnection } from '@shared/infrastructure/redis/redis-connection.helper';
import { REDIS_CLIENT } from '@shared/infrastructure/redis/RedisModule';

const HEARTBEAT_KEY = 'messaging:worker:heartbeat';
const HEARTBEAT_TTL_S = 30;
const HEARTBEAT_INTERVAL_MS = 15_000;

@Injectable()
export class OutboundMessageProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboundMessageProcessor.name);
  private worker: Worker;
  private heartbeatInterval: ReturnType<typeof setInterval>;

  constructor(
    private readonly configService: ConfigService,
    private readonly processOutboundUseCase: ProcessOutboundMessageUseCase,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  onModuleInit() {
    const connection = parseRedisConnection(this.configService);

    this.worker = new Worker(
      'outbound-messages',
      async (job: Job<{ messageId: string; tenantId: string }>) => {
        this.logger.log(
          JSON.stringify(
            buildQueueTelemetry('outbound-messages', job, 'processing', {
              messageId: job.data.messageId,
            }),
          ),
        );
        await this.processOutboundUseCase.execute({
          messageId: job.data.messageId,
          tenantId: job.data.tenantId ?? '',
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

    const writeHeartbeat = () => {
      this.redis
        .set(HEARTBEAT_KEY, '1', 'EX', HEARTBEAT_TTL_S)
        .catch((err) =>
          this.logger.warn(`Heartbeat write failed: ${(err as Error).message}`),
        );
    };
    writeHeartbeat();
    this.heartbeatInterval = setInterval(writeHeartbeat, HEARTBEAT_INTERVAL_MS);
    this.logger.log('Outbound worker started — heartbeat active');
  }

  async onModuleDestroy() {
    clearInterval(this.heartbeatInterval);
    if (this.worker) {
      await this.worker.close();
    }
  }
}
