import { IEventBus } from '@shared/application/ports/IEventBus';
import { IntegrationEvent } from '@shared/application/ports/IntegrationEvent';

export class InMemoryEventBus implements IEventBus {
  readonly published: IntegrationEvent[] = [];

  async publish(event: IntegrationEvent): Promise<void> {
    this.published.push(event);
  }

  subscribe(): void {
    // no-op for tests
  }

  reset(): void {
    this.published.length = 0;
  }

  getByEventName(name: string): IntegrationEvent[] {
    return this.published.filter((e) => e.eventName === name);
  }

  firstByEventName(name: string): IntegrationEvent | undefined {
    return this.published.find((e) => e.eventName === name);
  }
}
