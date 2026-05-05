import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  ISchedulingReminderQueue,
  SchedulingReminderQueueJob,
} from '../../domain/ports/ISchedulingReminderQueue';

@Injectable()
export class BullMQSchedulingReminderQueue
  implements ISchedulingReminderQueue, OnModuleDestroy
{
  private readonly queue: Queue<SchedulingReminderQueueJob>;

  constructor(private readonly configService: ConfigService) {
    const connection = {
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
    };

    this.queue = new Queue<SchedulingReminderQueueJob>('scheduling-reminders', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    });
  }

  async addJob(job: SchedulingReminderQueueJob): Promise<void> {
    const runAt = new Date(job.runAt).getTime();
    const delay = Math.max(0, runAt - Date.now());

    await this.queue.add('send-scheduling-reminder', job, {
      jobId: [
        'scheduling-reminder',
        job.tenantId,
        job.professionalId,
        job.date,
        job.slotId,
        `${job.offsetHours}h`,
      ].join('__'),
      delay,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
