import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IEventBus } from '../../application/ports/IEventBus';
import { IntegrationEvent } from '../../application/ports/IntegrationEvent';
import { SerializedIntegrationEvent } from './BullMQEventBus';
import { PrismaInboxStore } from './PrismaInboxStore';

const amqp = require('amqplib');

type AmqpConnection = {
  createChannel: () => Promise<AmqpChannel>;
  close: () => Promise<void>;
};

type AmqpChannel = {
  assertExchange: (
    exchange: string,
    type: string,
    options?: Record<string, unknown>,
  ) => Promise<unknown>;
  assertQueue: (
    queue: string,
    options?: Record<string, unknown>,
  ) => Promise<unknown>;
  bindQueue: (
    queue: string,
    exchange: string,
    routingKey: string,
  ) => Promise<unknown>;
  prefetch: (count: number) => Promise<unknown> | unknown;
  consume: (
    queue: string,
    onMessage: (message: AmqpMessage | null) => Promise<void>,
  ) => Promise<unknown>;
  publish: (
    exchange: string,
    routingKey: string,
    content: Buffer,
    options?: Record<string, unknown>,
  ) => boolean;
  ack: (message: AmqpMessage) => void;
  nack: (message: AmqpMessage, allUpTo?: boolean, requeue?: boolean) => void;
  close: () => Promise<void>;
};

type AmqpMessage = {
  content: Buffer;
};

@Injectable()
export class RabbitMQEventBus implements IEventBus, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQEventBus.name);
  private connectionPromise?: Promise<AmqpConnection>;
  private publishChannelPromise?: Promise<AmqpChannel>;
  private readonly consumerChannels: AmqpChannel[] = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly inboxStore: PrismaInboxStore,
  ) {}

  async publish<T extends IntegrationEvent>(event: T): Promise<void> {
    const serializedEvent = event.toJSON();

    await this.publishSerialized({
      eventId: event.eventId,
      eventType: event.eventType,
      queue: event.queue,
      sourceModule: event.sourceModule,
      timestamp: event.timestamp.toISOString(),
      payload: event.payload,
      eventName:
        typeof serializedEvent.eventName === 'string'
          ? serializedEvent.eventName
          : undefined,
      version:
        typeof serializedEvent.version === 'number'
          ? serializedEvent.version
          : undefined,
      aggregateId:
        typeof serializedEvent.aggregateId === 'string'
          ? serializedEvent.aggregateId
          : undefined,
      tenantId:
        typeof serializedEvent.tenantId === 'string'
          ? serializedEvent.tenantId
          : undefined,
      correlationId:
        typeof serializedEvent.correlationId === 'string'
          ? serializedEvent.correlationId
          : undefined,
      causationId:
        typeof serializedEvent.causationId === 'string'
          ? serializedEvent.causationId
          : undefined,
    });
  }

  async publishSerialized(event: SerializedIntegrationEvent): Promise<void> {
    const channel = await this.getPublishChannel();
    const exchange = await this.assertExchange(channel);
    const payload = Buffer.from(
      JSON.stringify({
        eventId: event.eventId,
        eventType: event.eventType,
        eventName: event.eventName ?? event.queue,
        sourceModule: event.sourceModule,
        version: event.version ?? 1,
        aggregateId:
          event.aggregateId ?? this.extractString(event.payload, 'aggregateId'),
        tenantId:
          event.tenantId ?? this.extractString(event.payload, 'tenantId'),
        correlationId:
          event.correlationId ??
          this.extractString(event.payload, 'correlationId'),
        causationId:
          event.causationId ?? this.extractString(event.payload, 'causationId'),
        occurredAt: event.timestamp,
        timestamp: event.timestamp,
        payload: event.payload,
      }),
    );

    channel.publish(exchange, event.queue, payload, {
      persistent: true,
      messageId: event.eventId,
      type: event.eventType,
      contentType: 'application/json',
      timestamp: Date.parse(event.timestamp),
    });

    this.logger.log(
      `Published [${event.eventType}] with routing key [${event.queue}]`,
    );
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
    void this.createConsumer(queue, handler, options);
  }

  private async createConsumer<T extends IntegrationEvent>(
    routingKey: string,
    handler: (event: T) => Promise<void>,
    options?: {
      consumerName?: string;
      concurrency?: number;
      retries?: number;
    },
  ): Promise<void> {
    const connection = await this.getConnection();
    const channel = await connection.createChannel();
    const exchange = await this.assertExchange(channel);
    const consumerQueue = this.buildQueueName(
      routingKey,
      options?.consumerName,
    );
    const deadLetterQueue = `${consumerQueue}.dlq`;

    await channel.assertExchange(this.getDeadLetterExchange(), 'topic', {
      durable: true,
    });
    await channel.assertQueue(consumerQueue, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': this.getDeadLetterExchange(),
        'x-dead-letter-routing-key': deadLetterQueue,
      },
    });
    await channel.assertQueue(deadLetterQueue, { durable: true });
    await channel.bindQueue(consumerQueue, exchange, routingKey);
    await channel.bindQueue(
      deadLetterQueue,
      this.getDeadLetterExchange(),
      deadLetterQueue,
    );
    await channel.prefetch(options?.concurrency ?? 5);

    await channel.consume(consumerQueue, async (message) => {
      if (!message) {
        return;
      }

      let inboxEntryId: string | null = null;

      try {
        const parsed = JSON.parse(message.content.toString()) as T &
          Partial<{
            eventId: string;
            eventType: string;
            payload: Record<string, unknown>;
          }>;

        if (typeof parsed.eventId === 'string') {
          inboxEntryId = await this.inboxStore.claim({
            consumerName: options?.consumerName ?? routingKey,
            eventId: parsed.eventId,
            eventType:
              typeof parsed.eventType === 'string'
                ? parsed.eventType
                : 'UnknownIntegrationEvent',
            queue: routingKey,
            payload: this.extractPayload(parsed.payload),
          });

          if (!inboxEntryId) {
            this.logger.warn(
              `Ignoring duplicated event [${parsed.eventId}] for consumer [${options?.consumerName ?? routingKey}]`,
            );
            channel.ack(message);
            return;
          }
        }

        await handler(parsed);
        if (inboxEntryId) {
          await this.inboxStore.markProcessed(inboxEntryId);
        }
        channel.ack(message);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown RabbitMQ error';
        if (inboxEntryId) {
          await this.inboxStore.markFailed(inboxEntryId, errorMessage);
        }
        this.logger.error(
          `Failed consumer [${consumerQueue}] for [${routingKey}]: ${errorMessage}`,
        );
        channel.nack(message, false, false);
      }
    });

    this.consumerChannels.push(channel);
    this.logger.log(
      `Subscribed consumer [${consumerQueue}] to routing key [${routingKey}]`,
    );
  }

  private async getPublishChannel(): Promise<AmqpChannel> {
    if (!this.publishChannelPromise) {
      this.publishChannelPromise = (async () => {
        const connection = await this.getConnection();
        const channel = await connection.createChannel();
        await this.assertExchange(channel);
        await channel.assertExchange(this.getDeadLetterExchange(), 'topic', {
          durable: true,
        });
        return channel;
      })();
    }

    return this.publishChannelPromise;
  }

  private async getConnection(): Promise<AmqpConnection> {
    if (!this.connectionPromise) {
      this.connectionPromise = amqp.connect(this.getUrl());
    }

    return this.connectionPromise!;
  }

  private async assertExchange(channel: AmqpChannel): Promise<string> {
    const exchange = this.getExchange();
    await channel.assertExchange(exchange, 'topic', { durable: true });
    return exchange;
  }

  private buildQueueName(routingKey: string, consumerName?: string): string {
    const prefix = this.configService.get<string>(
      'RABBITMQ_QUEUE_PREFIX',
      'atendeai',
    );
    const safeRoutingKey = routingKey
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .toLowerCase();
    const safeConsumerName = (consumerName ?? routingKey)
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .toLowerCase();

    return `${prefix}.${safeConsumerName}.${safeRoutingKey}`;
  }

  private extractPayload(
    payload: Record<string, unknown> | undefined,
  ): Record<string, unknown> {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return {};
    }

    return payload;
  }

  private extractString(
    payload: Record<string, unknown>,
    key: string,
  ): string | undefined {
    const value = payload[key];
    return typeof value === 'string' ? value : undefined;
  }

  private getUrl(): string {
    return this.configService.get<string>(
      'RABBITMQ_URL',
      'amqp://guest:guest@127.0.0.1:5672',
    );
  }

  private getExchange(): string {
    return this.configService.get<string>(
      'RABBITMQ_EXCHANGE',
      'atendeai.events',
    );
  }

  private getDeadLetterExchange(): string {
    return this.configService.get<string>(
      'RABBITMQ_DLX',
      'atendeai.events.dlx',
    );
  }

  async onModuleDestroy(): Promise<void> {
    for (const channel of this.consumerChannels) {
      await channel.close().catch(() => undefined);
    }

    if (this.publishChannelPromise) {
      const publishChannel = await this.publishChannelPromise.catch(() => null);
      await publishChannel?.close().catch(() => undefined);
    }

    if (this.connectionPromise) {
      const connection = await this.connectionPromise.catch(() => null);
      await connection?.close().catch(() => undefined);
    }
  }
}
