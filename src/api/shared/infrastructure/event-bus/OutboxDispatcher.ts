import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullMQEventBus } from './BullMQEventBus';
import { PrismaOutboxStore } from './PrismaOutboxStore';
import { RabbitMQEventBus } from './RabbitMQEventBus';

@Injectable()
export class OutboxDispatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxDispatcher.name);
  private readonly pollIntervalMs: number;
  private readonly batchSize: number;
  private timer?: NodeJS.Timeout;
  private isRunning = false;

  constructor(
    private readonly bullMqEventBus: BullMQEventBus,
    private readonly rabbitMqEventBus: RabbitMQEventBus,
    private readonly outboxStore: PrismaOutboxStore,
    private readonly configService: ConfigService,
  ) {
    this.pollIntervalMs = this.configService.get<number>(
      'OUTBOX_POLL_INTERVAL_MS',
      1000,
    );
    this.batchSize = this.configService.get<number>('OUTBOX_BATCH_SIZE', 50);
  }

  onModuleInit(): void {
    if (this.getMode() !== 'outbox') {
      return;
    }

    this.timer = setInterval(() => {
      void this.flushPending();
    }, this.pollIntervalMs);

    this.logger.log(
      `Outbox dispatcher started with poll interval ${this.pollIntervalMs}ms`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async flushPending(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      const events = await this.outboxStore.claimPending(this.batchSize);

      for (const event of events) {
        try {
          await this.eventBus.publishSerialized({
            eventId: event.eventId,
            eventType: event.eventType,
            queue: event.queue,
            sourceModule: event.sourceModule,
            payload: event.payload,
            timestamp: event.timestamp,
          });
          await this.outboxStore.markPublished(event.id);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown outbox error';
          await this.outboxStore.markFailed(event.id, message);
          this.logger.error(
            `Failed to dispatch outbox event [${event.eventId}]: ${message}`,
          );
        }
      }
    } finally {
      this.isRunning = false;
    }
  }

  private getMode(): 'immediate' | 'outbox' {
    return this.configService.get<'immediate' | 'outbox'>(
      'EVENT_BUS_MODE',
      'immediate',
    );
  }

  private get eventBus(): BullMQEventBus | RabbitMQEventBus {
    return this.configService.get<'bullmq' | 'rabbitmq'>(
      'EVENT_BUS_TRANSPORT',
      'bullmq',
    ) === 'rabbitmq'
      ? this.rabbitMqEventBus
      : this.bullMqEventBus;
  }
}
