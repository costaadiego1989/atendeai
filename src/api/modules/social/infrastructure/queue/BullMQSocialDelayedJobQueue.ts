import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  ISocialDelayedJobQueue,
  DelayedInboxMessagePayload,
} from '../../domain/ports/ISocialDelayedJobQueue';

@Injectable()
export class BullMQSocialDelayedJobQueue implements ISocialDelayedJobQueue {
  constructor(
    @InjectQueue('social-delayed') private readonly queue: Queue,
  ) {}

  async addDelayedInboxMessage(payload: DelayedInboxMessagePayload): Promise<void> {
    const { delayMs, ...data } = payload;

    await this.queue.add('send-delayed-inbox-message', data, {
      delay: delayMs,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: 50,
    });
  }
}
