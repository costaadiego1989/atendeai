import { ProcessWebhookUseCase } from '@modules/payment/application/use-cases/ProcessWebhookUseCase';
import {
  PaymentConfirmedIntegrationEvent,
  PaymentOverdueIntegrationEvent,
  PaymentRefundedIntegrationEvent,
} from '@modules/payment/application/integration-events/PaymentIntegrationEvents';
import { PrismaTransactionalEventPublisher } from '@shared/infrastructure/event-bus/PrismaTransactionalEventPublisher';

describe('Payment ProcessWebhookUseCase', () => {
  let sut: ProcessWebhookUseCase;
  let paymentGateway: any;
  let webhookReceiptStore: any;
  let transactionalEventPublisher: jest.Mocked<PrismaTransactionalEventPublisher>;
  let executionOutcomes: Array<{ result: void; events: any[] }>;

  beforeEach(() => {
    paymentGateway = {
      createCustomer: jest.fn(),
      createSubaccount: jest.fn(),
      createSubscription: jest.fn(),
      updateSubscription: jest.fn(),
      cancelSubscription: jest.fn(),
      getSubscription: jest.fn(),
      createPayment: jest.fn(),
      deletePayment: jest.fn(),
      restorePayment: jest.fn(),
      createPaymentLink: jest.fn(),
      removePaymentLink: jest.fn(),
      restorePaymentLink: jest.fn(),
      parseWebhook: jest.fn(),
    };
    webhookReceiptStore = {
      registerReceived: jest.fn(),
      markProcessed: jest.fn(),
      markIgnored: jest.fn(),
    };
    executionOutcomes = [];
    transactionalEventPublisher = {
      execute: jest.fn(async (work: any) => {
        const outcome = await work({} as any);
        executionOutcomes.push(outcome);
        return outcome.result;
      }),
    } as any;

    sut = new ProcessWebhookUseCase(
      paymentGateway,
      webhookReceiptStore,
      transactionalEventPublisher,
    );
  });

  it('should publish payment events with deterministic idempotent eventId', async () => {
    const occurredAt = new Date('2026-03-25T14:00:00.000Z');
    paymentGateway.parseWebhook.mockReturnValue({
      provider: 'ASAAS',
      eventType: 'PAYMENT_CONFIRMED',
      paymentId: 'pay-123',
      tenantId: 'tenant-1',
      amount: 99,
      occurredAt,
      rawReference: 'tenant-1',
      rawPayload: {},
    });
    webhookReceiptStore.registerReceived.mockResolvedValue({
      id: 'receipt-1',
      isNew: true,
    });

    await sut.execute({ event: 'PAYMENT_CONFIRMED' });

    expect(webhookReceiptStore.registerReceived).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'ASAAS',
        eventType: 'PAYMENT_CONFIRMED',
      }),
      undefined,
      expect.any(Object),
    );
    expect(transactionalEventPublisher.execute).toHaveBeenCalledTimes(1);
    const publishedEvent = executionOutcomes[0].events[0];
    expect(publishedEvent).toBeInstanceOf(PaymentConfirmedIntegrationEvent);
    expect(publishedEvent.eventId).toBe(
      'payment:ASAAS:PAYMENT_CONFIRMED:pay-123',
    );
    expect(publishedEvent.payload).toEqual({
      tenantId: 'tenant-1',
      paymentId: 'pay-123',
      amount: 99,
      provider: 'ASAAS',
      rawReference: 'tenant-1',
      occurredAt,
      confirmedAt: occurredAt,
    });
    expect(webhookReceiptStore.markProcessed).toHaveBeenCalledWith(
      'receipt-1',
      expect.any(Object),
    );
  });

  it('should ignore the webhook when the provider cannot parse it', async () => {
    paymentGateway.parseWebhook.mockReturnValue(null);

    await sut.execute({ event: 'UNKNOWN' });

    expect(webhookReceiptStore.registerReceived).not.toHaveBeenCalled();
    expect(transactionalEventPublisher.execute).not.toHaveBeenCalled();
  });

  it('should ignore parsed events without tenantId', async () => {
    paymentGateway.parseWebhook.mockReturnValue({
      provider: 'ASAAS',
      eventType: 'PAYMENT_CONFIRMED',
      paymentId: 'pay-123',
      rawPayload: {},
    });
    webhookReceiptStore.registerReceived.mockResolvedValue({
      id: 'receipt-2',
      isNew: true,
    });

    await sut.execute({ event: 'PAYMENT_CONFIRMED' });

    expect(executionOutcomes[0].events).toEqual([]);
    expect(webhookReceiptStore.markIgnored).toHaveBeenCalledWith(
      'receipt-2',
      'TENANT_ID_MISSING',
      expect.any(Object),
    );
  });

  it('should ignore duplicate webhook receipts before publishing', async () => {
    paymentGateway.parseWebhook.mockReturnValue({
      provider: 'ASAAS',
      eventType: 'PAYMENT_CONFIRMED',
      paymentId: 'pay-123',
      tenantId: 'tenant-1',
      amount: 99,
      rawPayload: {},
    });
    webhookReceiptStore.registerReceived.mockResolvedValue({
      id: 'receipt-duplicate',
      isNew: false,
    });

    await sut.execute({ event: 'PAYMENT_CONFIRMED' });

    expect(transactionalEventPublisher.execute).toHaveBeenCalledTimes(1);
    expect(webhookReceiptStore.markProcessed).not.toHaveBeenCalled();
  });

  it('should publish overdue events for PAYMENT_OVERDUE and SUBSCRIPTION_DELETED', async () => {
    const overdueAt = new Date('2026-03-26T10:00:00.000Z');
    const deletedAt = new Date('2026-03-27T11:30:00.000Z');
    paymentGateway.parseWebhook
      .mockReturnValueOnce({
        provider: 'ASAAS',
        eventType: 'PAYMENT_OVERDUE',
        paymentId: 'pay-overdue',
        tenantId: 'tenant-1',
        amount: 199,
        occurredAt: overdueAt,
        rawReference: 'tenant-1',
        rawPayload: {},
      })
      .mockReturnValueOnce({
        provider: 'ASAAS',
        eventType: 'SUBSCRIPTION_DELETED',
        paymentId: 'sub-123',
        tenantId: 'tenant-1',
        amount: 199,
        occurredAt: deletedAt,
        rawReference: 'tenant-1',
        rawPayload: {},
      });
    webhookReceiptStore.registerReceived
      .mockResolvedValueOnce({
        id: 'receipt-3',
        isNew: true,
      })
      .mockResolvedValueOnce({
        id: 'receipt-4',
        isNew: true,
      });

    await sut.execute({ event: 'PAYMENT_OVERDUE' });
    await sut.execute({ event: 'SUBSCRIPTION_DELETED' });

    const firstOutcome = executionOutcomes[0];
    const secondOutcome = executionOutcomes[1];
    expect(firstOutcome.events[0]).toBeInstanceOf(
      PaymentOverdueIntegrationEvent,
    );
    expect(firstOutcome.events[0].eventId).toBe(
      'payment:ASAAS:PAYMENT_OVERDUE:pay-overdue',
    );
    expect(firstOutcome.events[0].payload).toEqual({
      tenantId: 'tenant-1',
      paymentId: 'pay-overdue',
      amount: 199,
      provider: 'ASAAS',
      rawReference: 'tenant-1',
      occurredAt: overdueAt,
      overdueAt,
    });
    expect(secondOutcome.events[0]).toBeInstanceOf(
      PaymentOverdueIntegrationEvent,
    );
    expect(secondOutcome.events[0].eventId).toBe(
      'payment:ASAAS:SUBSCRIPTION_DELETED:sub-123',
    );
    expect(secondOutcome.events[0].payload).toEqual({
      tenantId: 'tenant-1',
      paymentId: 'sub-123',
      amount: 199,
      provider: 'ASAAS',
      rawReference: 'tenant-1',
      occurredAt: deletedAt,
      overdueAt: deletedAt,
    });
    expect(webhookReceiptStore.markProcessed).toHaveBeenCalledWith(
      'receipt-3',
      expect.any(Object),
    );
    expect(webhookReceiptStore.markProcessed).toHaveBeenCalledWith(
      'receipt-4',
      expect.any(Object),
    );
  });

  it('should publish refunded events with deterministic idempotent eventId', async () => {
    const refundedAt = new Date('2026-03-28T16:45:00.000Z');
    paymentGateway.parseWebhook.mockReturnValue({
      provider: 'ASAAS',
      eventType: 'PAYMENT_REFUNDED',
      paymentId: 'pay-ref-1',
      tenantId: 'tenant-1',
      amount: 49,
      occurredAt: refundedAt,
      rawReference: 'tenant-1',
      rawPayload: {},
    });
    webhookReceiptStore.registerReceived.mockResolvedValue({
      id: 'receipt-5',
      isNew: true,
    });

    await sut.execute({ event: 'PAYMENT_REFUNDED' });

    const publishedEvent = executionOutcomes[0].events[0];
    expect(publishedEvent).toBeInstanceOf(PaymentRefundedIntegrationEvent);
    expect(publishedEvent.eventId).toBe(
      'payment:ASAAS:PAYMENT_REFUNDED:pay-ref-1',
    );
    expect(publishedEvent.payload).toEqual({
      tenantId: 'tenant-1',
      paymentId: 'pay-ref-1',
      amount: 49,
      provider: 'ASAAS',
      rawReference: 'tenant-1',
      occurredAt: refundedAt,
      refundedAt,
    });
    expect(webhookReceiptStore.markProcessed).toHaveBeenCalledWith(
      'receipt-5',
      expect.any(Object),
    );
  });
});
