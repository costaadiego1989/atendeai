import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IEventBus } from '../../application/ports/IEventBus';
import { IntegrationEvent } from '../../application/ports/IntegrationEvent';
import { BullMQEventBus } from './BullMQEventBus';
import { PrismaOutboxStore } from './PrismaOutboxStore';
import { RabbitMQEventBus } from './RabbitMQEventBus';

@Injectable()
export class OutboxEventBus implements IEventBus {
  constructor(
    private readonly bullMqEventBus: BullMQEventBus,
    private readonly rabbitMqEventBus: RabbitMQEventBus,
    private readonly outboxStore: PrismaOutboxStore,
    private readonly configService: ConfigService,
  ) {}

  async publish<T extends IntegrationEvent>(event: T): Promise<void> {
    if (this.getMode() === 'outbox') {
      await this.outboxStore.append(event);
      return;
    }

    await this.getTransport().publish(event);
  }

  subscribe<T extends IntegrationEvent>(
    queue: string,
    handler: (event: T) => Promise<void>,
    options?: {
      consumerName?: string;
      concurrency?: number;
      retries?: number;
    },
  ): void {
    this.getTransport().subscribe(queue, handler, options);
  }

  private getMode(): 'immediate' | 'outbox' {
    return this.configService.get<'immediate' | 'outbox'>(
      'EVENT_BUS_MODE',
      'immediate',
    );
  }

  private getTransport(): BullMQEventBus | RabbitMQEventBus {
    return this.configService.get<'bullmq' | 'rabbitmq'>(
      'EVENT_BUS_TRANSPORT',
      'bullmq',
    ) === 'rabbitmq'
      ? this.rabbitMqEventBus
      : this.bullMqEventBus;
  }
}
