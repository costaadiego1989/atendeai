import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  ISchedulingReservationExpirationQueue,
  SchedulingReservationExpirationJob,
} from '../../domain/ports/ISchedulingReservationExpirationQueue';

@Injectable()
export class BullMQSchedulingReservationExpirationQueue
  implements ISchedulingReservationExpirationQueue, OnModuleDestroy
{
  private readonly queue: Queue<SchedulingReservationExpirationJob>;

  constructor(private readonly configService: ConfigService) {
    const connection = {
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
    };

    this.queue = new Queue('scheduling-reservation-expirations', {
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

  async addJob(job: SchedulingReservationExpirationJob): Promise<void> {
    const runAt = new Date(job.runAt).getTime();
    const delay = Math.max(0, runAt - Date.now());

    await this.queue.add('expire-scheduling-reservation', job, {
      jobId: `scheduling-reservation-expiration-${job.tenantId}-${job.professionalId}-${job.date}-${job.slotId}-${runAt}`,
      delay,
    });
  }

  async onModuleDestroy() {
    await this.queue.close();
  }
}
