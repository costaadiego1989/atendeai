import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  IMessageQueue,
  MessageQueueJob,
} from '../../domain/ports/IMessageQueue';
import { parseRedisConnection } from '@shared/infrastructure/redis/redis-connection.helper';

@Injectable()
export class BullMQMessageQueue implements IMessageQueue, OnModuleDestroy {
  private readonly queue: Queue<MessageQueueJob>;

  constructor(private readonly configService: ConfigService) {
    const connection = parseRedisConnection(this.configService);

    this.queue = new Queue('outbound-messages', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000, // 5s, 10s, 20s...
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });
  }

  async addJob(job: MessageQueueJob): Promise<void> {
    await this.queue.add('send-whatsapp', job, {
      jobId: `msg-${job.messageId}`,
    });
  }

  async onModuleDestroy() {
    await this.queue.close();
  }
}
