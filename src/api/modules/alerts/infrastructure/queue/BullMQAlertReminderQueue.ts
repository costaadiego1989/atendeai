import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  AlertReminderQueueJob,
  IAlertReminderQueue,
} from '../../domain/ports/IAlertReminderQueue';
import { parseRedisConnection } from '@shared/infrastructure/redis/redis-connection.helper';

@Injectable()
export class BullMQAlertReminderQueue
  implements IAlertReminderQueue, OnModuleDestroy
{
  private readonly queue: Queue<AlertReminderQueueJob>;

  constructor(private readonly configService: ConfigService) {
    const connection = parseRedisConnection(this.configService);

    this.queue = new Queue('alert-reminders', {
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

  async addJob(job: AlertReminderQueueJob): Promise<void> {
    const runAt = new Date(job.runAt).getTime();
    const delay = Math.max(0, runAt - Date.now());

    await this.queue.add('process-alert-reminder', job, {
      jobId: `alert-reminder-${job.reminderId}-${runAt}`,
      delay,
    });
  }

  async onModuleDestroy() {
    await this.queue.close();
  }
}
