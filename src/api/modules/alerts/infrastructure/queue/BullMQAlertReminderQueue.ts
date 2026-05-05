import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  AlertReminderQueueJob,
  IAlertReminderQueue,
} from '../../domain/ports/IAlertReminderQueue';

@Injectable()
export class BullMQAlertReminderQueue
  implements IAlertReminderQueue, OnModuleDestroy
{
  private readonly queue: Queue<AlertReminderQueueJob>;

  constructor(private readonly configService: ConfigService) {
    const connection = {
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
    };

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
