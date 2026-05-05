import { IntegrationEvent } from './IntegrationEvent';

export interface IEventBus {
  publish<T extends IntegrationEvent>(event: T): Promise<void>;

  subscribe<T extends IntegrationEvent>(
    queue: string,
    handler: (event: T) => Promise<void>,
    options?: {
      consumerName?: string;
      concurrency?: number;
      retries?: number;
    },
  ): void;
}

export const EVENT_BUS = Symbol('EVENT_BUS');
