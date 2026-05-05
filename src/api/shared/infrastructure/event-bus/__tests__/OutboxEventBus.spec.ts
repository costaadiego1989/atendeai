import { ConfigService } from '@nestjs/config';
import { OutboxEventBus } from '../OutboxEventBus';
import { IntegrationEvent } from '../../../application/ports/IntegrationEvent';

class TestIntegrationEvent extends IntegrationEvent {
  readonly queue = 'test.queue';
  readonly sourceModule = 'test';

  constructor(
    public readonly payload: {
      tenantId: string;
    },
  ) {
    super('test-event-id');
  }
}

describe('OutboxEventBus', () => {
  let bullMqEventBus: { publish: jest.Mock; subscribe: jest.Mock };
  let rabbitMqEventBus: { publish: jest.Mock; subscribe: jest.Mock };
  let outboxStore: { append: jest.Mock };
  let configService: { get: jest.Mock };
  let sut: OutboxEventBus;

  beforeEach(() => {
    bullMqEventBus = {
      publish: jest.fn(),
      subscribe: jest.fn(),
    };
    rabbitMqEventBus = {
      publish: jest.fn(),
      subscribe: jest.fn(),
    };
    outboxStore = {
      append: jest.fn(),
    };
    configService = {
      get: jest.fn(),
    };

    sut = new OutboxEventBus(
      bullMqEventBus as any,
      rabbitMqEventBus as any,
      outboxStore as any,
      configService as unknown as ConfigService,
    );
  });

  it('should persist events to outbox when mode is outbox', async () => {
    configService.get.mockReturnValue('outbox');
    const event = new TestIntegrationEvent({ tenantId: 'tenant-1' });

    await sut.publish(event);

    expect(outboxStore.append).toHaveBeenCalledWith(event);
    expect(bullMqEventBus.publish).not.toHaveBeenCalled();
    expect(rabbitMqEventBus.publish).not.toHaveBeenCalled();
  });

  it('should publish immediately when mode is immediate', async () => {
    configService.get.mockImplementation((key: string, defaultValue?: unknown) => {
      if (key === 'EVENT_BUS_MODE') return 'immediate';
      if (key === 'EVENT_BUS_TRANSPORT') return 'bullmq';
      return defaultValue;
    });
    const event = new TestIntegrationEvent({ tenantId: 'tenant-1' });

    await sut.publish(event);

    expect(bullMqEventBus.publish).toHaveBeenCalledWith(event);
    expect(outboxStore.append).not.toHaveBeenCalled();
  });

  it('should delegate subscriptions to the configured transport bus', () => {
    configService.get.mockImplementation((key: string, defaultValue?: unknown) => {
      if (key === 'EVENT_BUS_MODE') return 'outbox';
      if (key === 'EVENT_BUS_TRANSPORT') return 'rabbitmq';
      return defaultValue;
    });
    const handler = jest.fn();

    sut.subscribe('payment.confirmed', handler, {
      consumerName: 'billing-payment-confirmed',
    });

    expect(rabbitMqEventBus.subscribe).toHaveBeenCalledWith(
      'payment.confirmed',
      handler,
      { consumerName: 'billing-payment-confirmed' },
    );
  });
});
