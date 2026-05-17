import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  IProspectDispatchQueue,
  ProspectDispatchJob,
} from '../../domain/ports/IProspectDispatchQueue';
import { parseRedisConnection } from '@shared/infrastructure/redis/redis-connection.helper';

@Injectable()
export class BullMQProspectDispatchQueue
  implements IProspectDispatchQueue, OnModuleDestroy
{
  private readonly queue: Queue<ProspectDispatchJob>;

  constructor(private readonly configService: ConfigService) {
    const connection = parseRedisConnection(this.configService);

    this.queue = new Queue('prospecting-dispatch', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });
  }

  async scheduleNextDispatch(
    job: ProspectDispatchJob,
    delayMs: number,
  ): Promise<void> {
    await this.queue.add('dispatch-next', job, { delay: delayMs });
  }

  async onModuleDestroy() {
    await this.queue.close();
  }
}
