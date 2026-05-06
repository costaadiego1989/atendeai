import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { IEventBus } from '../../application/ports/IEventBus';
import { IntegrationEvent } from '../../application/ports/IntegrationEvent';
import { buildQueueTelemetry } from '../queue/QueueJobTelemetry';
import { REDIS_CLIENT } from '../redis/RedisModule';

export interface SerializedIntegrationEvent {
  eventId: string;
  eventType: string;
  queue: string;
  sourceModule: string;
  timestamp: string;
  payload: Record<string, unknown>;
  eventName?: string;
  version?: number;
  aggregateId?: string;
  tenantId?: string;
  correlationId?: string;
  causationId?: string;
}

@Injectable()
export class BullMQEventBus implements IEventBus, OnModuleDestroy {
  private readonly logger = new Logger(BullMQEventBus.name);
  private readonly queues = new Map<string, Queue>();
  private readonly workers: Worker[] = [];
  private readonly consumerQueues = new Map<string, Set<string>>();
  private readonly connection: Redis;

  constructor(
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly connection: Redis,
  ) {
    this.connection.on('error', (err) => {
      this.logger.error(`Redis Connection Error: ${err.message}`);
    });
  }

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
    const targetQueues = this.getTargetQueues(event.queue);

    for (const queueName of targetQueues) {
      const queue = this.getOrCreateQueue(queueName);

      await queue.add(
        event.eventType,
        {
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
            event.correlationId ?? this.extractString(event.payload, 'correlationId'),
          causationId:
            event.causationId ?? this.extractString(event.payload, 'causationId'),
          occurredAt: event.timestamp,
          timestamp: event.timestamp,
          queue: event.queue,
          payload: event.payload,
        },
        {
          removeOnComplete: 100,
          removeOnFail: 500,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      );

      this.logger.log(
        `Published [${event.eventType}] to queue [${queueName}] (topic [${event.queue}])`,
      );
    }
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
    const workerQueueName = options?.consumerName
      ? `${queue}.${options.consumerName}`
      : queue;

    if (options?.consumerName) {
      const consumerQueues = this.consumerQueues.get(queue) ?? new Set<string>();
      consumerQueues.add(workerQueueName);
      this.consumerQueues.set(queue, consumerQueues);
    }

    const worker = new Worker(
      workerQueueName,
      async (job) => {
        this.logger.log(
          JSON.stringify(
            buildQueueTelemetry(workerQueueName, job, 'processing', {
              topic: queue,
              eventType: job.name,
              attempt: job.attemptsMade + 1,
            }),
          ),
        );
        await handler(job.data as T);
      },
      {
        connection: this.connection,
        concurrency: options?.concurrency ?? 5,
      },
    );

    worker.on('failed', (job, err) => {
      if (!job) return;
      this.logger.error(
        JSON.stringify(
          buildQueueTelemetry(workerQueueName, job, 'failed', {
            topic: queue,
            error: err.message,
          }),
        ),
      );
    });

    worker.on('completed', (job) => {
      this.logger.log(
        JSON.stringify(
          buildQueueTelemetry(workerQueueName, job, 'completed', {
            topic: queue,
          }),
        ),
      );
    });

    this.workers.push(worker);
    this.logger.log(
      `Subscribed to queue [${workerQueueName}] for topic [${queue}]`,
    );
  }

  private getTargetQueues(queueName: string): string[] {
    const consumerQueues = this.consumerQueues.get(queueName);

    if (consumerQueues && consumerQueues.size > 0) {
      return [...consumerQueues];
    }

    return [queueName];
  }

  private getOrCreateQueue(queueName: string): Queue {
    let queue = this.queues.get(queueName);
    if (!queue) {
      queue = new Queue(queueName, {
        connection: this.connection,
      });
      this.queues.set(queueName, queue);
    }
    return queue;
  }

  private extractString(
    payload: Record<string, unknown>,
    key: string,
  ): string | undefined {
    const value = payload[key];
    return typeof value === 'string' ? value : undefined;
  }

  async onModuleDestroy(): Promise<void> {
    for (const worker of this.workers) {
      await worker.close();
    }
    for (const queue of this.queues.values()) {
      await queue.close();
    }
    this.connection.disconnect();
    this.logger.log('EventBus shut down gracefully');
  }
}
