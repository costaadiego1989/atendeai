jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    disconnect: jest.fn(),
  })),
}));

const addMock = jest.fn();
const closeMock = jest.fn().mockResolvedValue(undefined);
const workerMock = jest.fn().mockImplementation(() => ({
  on: jest.fn(),
  close: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: addMock,
    close: closeMock,
  })),
  Worker: workerMock,
}));

import { ConfigService } from '@nestjs/config';
import { BullMQEventBus } from '../BullMQEventBus';
import { IntegrationEvent } from '../../../application/ports/IntegrationEvent';

class TestIntegrationEvent extends IntegrationEvent {
  readonly queue = 'payment.confirmed';
  readonly sourceModule = 'payment';

  constructor() {
    super('payment:ASAAS:PAYMENT_CONFIRMED:pay-123');
  }

  readonly payload = {
    tenantId: 'tenant-1',
    paymentId: 'pay-123',
  };
}

describe('BullMQEventBus', () => {
  let configService: ConfigService;
  let sut: BullMQEventBus;

  beforeEach(() => {
    addMock.mockReset();
    closeMock.mockClear();
    configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === 'REDIS_HOST') return '127.0.0.1';
        if (key === 'REDIS_PORT') return 6379;
        return defaultValue;
      }),
    } as any;

    const redisConnection = { disconnect: jest.fn(), on: jest.fn() } as any;
    sut = new BullMQEventBus(configService, redisConnection);
  });

  it('should preserve the original event id in the payload without forcing BullMQ-level dedupe', async () => {
    await sut.publish(new TestIntegrationEvent());

    const [, payload, options] = addMock.mock.calls[0];

    expect(payload.eventId).toBe('payment:ASAAS:PAYMENT_CONFIRMED:pay-123');
    expect(options.jobId).toBeUndefined();
  });

  it('should fan out a topic to all consumer-specific queues when consumerName is provided', async () => {
    const handler = jest.fn();

    sut.subscribe('payment.confirmed', handler, {
      consumerName: 'billing-payment-confirmed',
    });
    sut.subscribe('payment.confirmed', handler, {
      consumerName: 'recovery-payment-confirmed',
    });

    addMock.mockClear();

    await sut.publish(new TestIntegrationEvent());

    expect(workerMock).toHaveBeenCalledWith(
      'payment.confirmed.billing-payment-confirmed',
      expect.any(Function),
      expect.any(Object),
    );
    expect(workerMock).toHaveBeenCalledWith(
      'payment.confirmed.recovery-payment-confirmed',
      expect.any(Function),
      expect.any(Object),
    );
    expect(addMock).toHaveBeenCalledTimes(2);
    expect(addMock.mock.calls.map((call) => call[0])).toEqual([
      'TestIntegrationEvent',
      'TestIntegrationEvent',
    ]);
  });
});
