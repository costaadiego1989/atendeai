import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  ISchedulingReservationExpirationQueue,
  SchedulingReservationExpirationJob,
} from '../../domain/ports/ISchedulingReservationExpirationQueue';
import { parseRedisConnection } from '@shared/infrastructure/redis/redis-connection.helper';

@Injectable()
export class BullMQSchedulingReservationExpirationQueue
  implements ISchedulingReservationExpirationQueue, OnModuleDestroy
{
  private readonly queue: Queue<SchedulingReservationExpirationJob>;

  constructor(private readonly configService: ConfigService) {
    const connection = parseRedisConnection(this.configService);

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
