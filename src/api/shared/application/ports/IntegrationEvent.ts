import { randomUUID } from 'crypto';

export abstract class IntegrationEvent {
  public readonly eventId: string;
  public readonly timestamp: Date;

  abstract readonly queue: string;
  abstract readonly sourceModule: string;
  abstract readonly payload: Record<string, unknown>;

  constructor(eventId?: string) {
    this.eventId = eventId ?? randomUUID();
    this.timestamp = new Date();
  }

  get eventType(): string {
    return this.constructor.name;
  }

  get eventName(): string {
    return this.queue;
  }

  get version(): number {
    return 1;
  }

  get aggregateId(): string | undefined {
    return this.extractString('aggregateId');
  }

  get tenantId(): string | undefined {
    return this.extractString('tenantId');
  }

  get correlationId(): string | undefined {
    return this.extractString('correlationId');
  }

  get causationId(): string | undefined {
    return this.extractString('causationId');
  }

  public toJSON(): Record<string, unknown> {
    return {
      eventId: this.eventId,
      eventType: this.eventType,
      eventName: this.eventName,
      sourceModule: this.sourceModule,
      version: this.version,
      aggregateId: this.aggregateId,
      tenantId: this.tenantId,
      correlationId: this.correlationId,
      causationId: this.causationId,
      occurredAt: this.timestamp.toISOString(),
      timestamp: this.timestamp.toISOString(),
      payload: this.payload,
    };
  }

  private extractString(key: string): string | undefined {
    const value = this.payload[key];
    return typeof value === 'string' ? value : undefined;
  }
}
