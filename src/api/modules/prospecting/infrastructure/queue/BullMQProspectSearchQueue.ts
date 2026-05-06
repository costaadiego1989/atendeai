import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  IProspectSearchQueue,
  ProspectSearchQueueJob,
} from '../../domain/ports/IProspectSearchQueue';
import { parseRedisConnection } from '@shared/infrastructure/redis/redis-connection.helper';

@Injectable()
export class BullMQProspectSearchQueue
  implements IProspectSearchQueue, OnModuleDestroy
{
  private readonly queue: Queue<ProspectSearchQueueJob>;

  constructor(private readonly configService: ConfigService) {
    const connection = parseRedisConnection(this.configService);

    this.queue = new Queue('prospect-searches', {
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

  async addJob(job: ProspectSearchQueueJob): Promise<void> {
    await this.queue.add('execute-prospect-search', job, {
      jobId: `prospect-search-${job.searchId}`,
    });
  }

  async onModuleDestroy() {
    await this.queue.close();
  }
}
