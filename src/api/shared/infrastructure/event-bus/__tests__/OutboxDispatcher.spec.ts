import { ConfigService } from '@nestjs/config';
import { OutboxDispatcher } from '../OutboxDispatcher';

describe('OutboxDispatcher', () => {
  let bullMqEventBus: { publishSerialized: jest.Mock };
  let rabbitMqEventBus: { publishSerialized: jest.Mock };
  let outboxStore: {
    claimPending: jest.Mock;
    markPublished: jest.Mock;
    markFailed: jest.Mock;
  };
  let configService: { get: jest.Mock };
  let sut: OutboxDispatcher;

  beforeEach(() => {
    bullMqEventBus = {
      publishSerialized: jest.fn(),
    };
    rabbitMqEventBus = {
      publishSerialized: jest.fn(),
    };
    outboxStore = {
      claimPending: jest.fn(),
      markPublished: jest.fn(),
      markFailed: jest.fn(),
    };
    configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === 'EVENT_BUS_MODE') return 'outbox';
        if (key === 'OUTBOX_POLL_INTERVAL_MS') return 1000;
        if (key === 'OUTBOX_BATCH_SIZE') return 50;
        if (key === 'EVENT_BUS_TRANSPORT') return 'rabbitmq';
        return defaultValue;
      }),
    };

    sut = new OutboxDispatcher(
      bullMqEventBus as any,
      rabbitMqEventBus as any,
      outboxStore as any,
      configService as unknown as ConfigService,
    );
  });

  it('should publish claimed events and mark them as published', async () => {
    outboxStore.claimPending.mockResolvedValue([
      {
        id: 'outbox-1',
        eventId: 'event-1',
        eventType: 'PaymentConfirmedIntegrationEvent',
        queue: 'payment.confirmed',
        sourceModule: 'payment',
        payload: { tenantId: 'tenant-1' },
        timestamp: '2026-03-29T12:00:00.000Z',
        attemptCount: 1,
        createdAt: new Date('2026-03-29T12:00:00.000Z'),
      },
    ]);

    await sut.flushPending();

    expect(rabbitMqEventBus.publishSerialized).toHaveBeenCalledWith({
      eventId: 'event-1',
      eventType: 'PaymentConfirmedIntegrationEvent',
      queue: 'payment.confirmed',
      sourceModule: 'payment',
      payload: { tenantId: 'tenant-1' },
      timestamp: '2026-03-29T12:00:00.000Z',
    });
    expect(outboxStore.markPublished).toHaveBeenCalledWith('outbox-1');
    expect(outboxStore.markFailed).not.toHaveBeenCalled();
  });

  it('should mark the outbox event as failed when publish throws', async () => {
    outboxStore.claimPending.mockResolvedValue([
      {
        id: 'outbox-2',
        eventId: 'event-2',
        eventType: 'MessageSentIntegrationEvent',
        queue: 'messaging.message-sent',
        sourceModule: 'messaging',
        payload: { tenantId: 'tenant-1' },
        timestamp: '2026-03-29T12:05:00.000Z',
        attemptCount: 1,
        createdAt: new Date('2026-03-29T12:05:00.000Z'),
      },
    ]);
    rabbitMqEventBus.publishSerialized.mockRejectedValue(
      new Error('Redis unavailable'),
    );

    await sut.flushPending();

    expect(outboxStore.markFailed).toHaveBeenCalledWith(
      'outbox-2',
      'Redis unavailable',
    );
    expect(outboxStore.markPublished).not.toHaveBeenCalled();
  });
});
