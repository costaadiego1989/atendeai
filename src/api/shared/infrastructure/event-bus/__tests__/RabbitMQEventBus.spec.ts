jest.mock('amqplib', () => ({
  connect: jest.fn(),
}));

import { ConfigService } from '@nestjs/config';
import { RabbitMQEventBus } from '../RabbitMQEventBus';
import { IntegrationEvent } from '../../../application/ports/IntegrationEvent';

const amqp = require('amqplib');

class TestIntegrationEvent extends IntegrationEvent {
  readonly queue = 'payment.confirmed';
  readonly sourceModule = 'payment';

  constructor(
    public readonly payload: {
      tenantId: string;
    },
  ) {
    super('rabbit-event-id');
  }
}

describe('RabbitMQEventBus', () => {
  let configService: { get: jest.Mock };
  let connection: { createChannel: jest.Mock; close: jest.Mock };
  let channel: any;
  let inboxStore: {
    claim: jest.Mock;
    markProcessed: jest.Mock;
    markFailed: jest.Mock;
  };
  let sut: RabbitMQEventBus;

  beforeEach(() => {
    channel = {
      assertExchange: jest.fn().mockResolvedValue(undefined),
      assertQueue: jest.fn().mockResolvedValue(undefined),
      bindQueue: jest.fn().mockResolvedValue(undefined),
      prefetch: jest.fn().mockResolvedValue(undefined),
      consume: jest.fn().mockResolvedValue(undefined),
      publish: jest.fn(),
      ack: jest.fn(),
      nack: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };
    connection = {
      createChannel: jest.fn().mockResolvedValue(channel),
      close: jest.fn(),
    };
    (amqp.connect as jest.Mock).mockResolvedValue(connection);
    inboxStore = {
      claim: jest.fn().mockResolvedValue('inbox-entry-1'),
      markProcessed: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
    };
    configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === 'RABBITMQ_URL') return 'amqp://guest:guest@127.0.0.1:5672';
        if (key === 'RABBITMQ_EXCHANGE') return 'atendeai.events';
        if (key === 'RABBITMQ_DLX') return 'atendeai.events.dlx';
        if (key === 'RABBITMQ_QUEUE_PREFIX') return 'atendeai';
        return defaultValue;
      }),
    };

    sut = new RabbitMQEventBus(
      configService as unknown as ConfigService,
      inboxStore as any,
    );
  });

  it('should publish events to the configured topic exchange', async () => {
    await sut.publish(new TestIntegrationEvent({ tenantId: 'tenant-1' }));

    const publishedPayload = JSON.parse(
      channel.publish.mock.calls[0][2].toString(),
    );

    expect(channel.assertExchange).toHaveBeenCalledWith(
      'atendeai.events',
      'topic',
      { durable: true },
    );
    expect(channel.publish).toHaveBeenCalledWith(
      'atendeai.events',
      'payment.confirmed',
      expect.any(Buffer),
      expect.objectContaining({
        messageId: 'rabbit-event-id',
        type: 'TestIntegrationEvent',
      }),
    );
    expect(publishedPayload).toEqual(
      expect.objectContaining({
        eventId: 'rabbit-event-id',
        eventType: 'TestIntegrationEvent',
        eventName: 'payment.confirmed',
        sourceModule: 'payment',
        version: 1,
        tenantId: 'tenant-1',
        occurredAt: expect.any(String),
        payload: { tenantId: 'tenant-1' },
      }),
    );
  });

  it('should create a consumer queue per consumer name and bind it to the routing key', async () => {
    const handler = jest.fn();

    sut.subscribe('payment.confirmed', handler as any, {
      consumerName: 'billing-payment-confirmed',
      concurrency: 3,
    });

    await new Promise((resolve) => setImmediate(resolve));

    expect(channel.assertQueue).toHaveBeenCalledWith(
      'atendeai.billing-payment-confirmed.payment-confirmed',
      expect.objectContaining({
        durable: true,
      }),
    );
    expect(channel.bindQueue).toHaveBeenCalledWith(
      'atendeai.billing-payment-confirmed.payment-confirmed',
      'atendeai.events',
      'payment.confirmed',
    );
    expect(channel.prefetch).toHaveBeenCalledWith(3);
  });

  it('should ignore duplicated events already claimed in the inbox', async () => {
    let onMessage: ((message: { content: Buffer }) => Promise<void>) | undefined;
    channel.consume.mockImplementation(
      async (
        _queue: string,
        callback: (message: { content: Buffer } | null) => Promise<void>,
      ) => {
        onMessage = callback;
      },
    );
    inboxStore.claim.mockResolvedValue(null);
    const handler = jest.fn();

    sut.subscribe('payment.confirmed', handler as any, {
      consumerName: 'billing-payment-confirmed',
    });

    await new Promise((resolve) => setImmediate(resolve));
    await onMessage?.({
      content: Buffer.from(
        JSON.stringify({
          eventId: 'event-1',
          eventType: 'PaymentConfirmedIntegrationEvent',
          payload: { tenantId: 'tenant-1' },
        }),
      ),
    });

    expect(inboxStore.claim).toHaveBeenCalledWith({
      consumerName: 'billing-payment-confirmed',
      eventId: 'event-1',
      eventType: 'PaymentConfirmedIntegrationEvent',
      queue: 'payment.confirmed',
      payload: { tenantId: 'tenant-1' },
    });
    expect(handler).not.toHaveBeenCalled();
    expect(channel.ack).toHaveBeenCalledTimes(1);
  });

  it('should mark claimed events as processed after the handler succeeds', async () => {
    let onMessage: ((message: { content: Buffer }) => Promise<void>) | undefined;
    channel.consume.mockImplementation(
      async (
        _queue: string,
        callback: (message: { content: Buffer } | null) => Promise<void>,
      ) => {
        onMessage = callback;
      },
    );
    const handler = jest.fn().mockResolvedValue(undefined);

    sut.subscribe('payment.confirmed', handler as any, {
      consumerName: 'billing-payment-confirmed',
    });

    await new Promise((resolve) => setImmediate(resolve));
    await onMessage?.({
      content: Buffer.from(
        JSON.stringify({
          eventId: 'event-2',
          eventType: 'PaymentConfirmedIntegrationEvent',
          payload: { tenantId: 'tenant-2' },
        }),
      ),
    });

    expect(handler).toHaveBeenCalledWith({
      eventId: 'event-2',
      eventType: 'PaymentConfirmedIntegrationEvent',
      payload: { tenantId: 'tenant-2' },
    });
    expect(inboxStore.markProcessed).toHaveBeenCalledWith('inbox-entry-1');
    expect(channel.ack).toHaveBeenCalledTimes(1);
  });

  it('should mark claimed events as failed and send them to DLQ when the handler fails', async () => {
    let onMessage: ((message: { content: Buffer }) => Promise<void>) | undefined;
    channel.consume.mockImplementation(
      async (
        _queue: string,
        callback: (message: { content: Buffer } | null) => Promise<void>,
      ) => {
        onMessage = callback;
      },
    );
    const handler = jest.fn().mockRejectedValue(new Error('boom'));

    sut.subscribe('payment.confirmed', handler as any, {
      consumerName: 'billing-payment-confirmed',
    });

    await new Promise((resolve) => setImmediate(resolve));
    await onMessage?.({
      content: Buffer.from(
        JSON.stringify({
          eventId: 'event-3',
          eventType: 'PaymentConfirmedIntegrationEvent',
          payload: { tenantId: 'tenant-3' },
        }),
      ),
    });

    expect(inboxStore.markFailed).toHaveBeenCalledWith('inbox-entry-1', 'boom');
    expect(channel.nack).toHaveBeenCalledWith(expect.anything(), false, false);
  });
});
