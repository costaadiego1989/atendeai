import { IEventBus } from '@shared/application/ports/IEventBus';
import { CommercePaymentEventHandler } from '../application/handlers/CommercePaymentEventHandler';
import { ICommerceRepository } from '../domain/ports/ICommerceRepository';
import { CommerceOrderPaidIntegrationEvent } from '../application/integration-events/CheckoutIntegrationEvents';
import { ISalesCouponRepository } from '@modules/sales/domain/repositories/ISalesRepository';

describe('CommercePaymentEventHandler', () => {
  let handler: CommercePaymentEventHandler;
  let eventBus: jest.Mocked<IEventBus>;
  let commerceRepository: jest.Mocked<ICommerceRepository>;
  let salesRepository: jest.Mocked<ISalesCouponRepository>;

  beforeEach(() => {
    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn(),
    };

    commerceRepository = {
      saveAuditLog: jest.fn().mockResolvedValue(undefined),
      upsertShippingPolicy: jest.fn(),
      findShippingPolicyByTenantId: jest.fn(),
      createSession: jest.fn(),
      findActiveSessionByConversation: jest.fn(),
      findSessionById: jest.fn(),
      addSessionItem: jest.fn(),
      updateSessionState: jest.fn(),
      createOrder: jest.fn(),
      findOrderById: jest.fn(),
      findOrderByPaymentReference: jest.fn(),
      listOrders: jest.fn(),
      updateOrderStatus: jest.fn(),
      markOrderPaidByPaymentReference: jest.fn(),
      findCatalogItemById: jest.fn(),
      findInventoryItemById: jest.fn(),
    } as unknown as jest.Mocked<ICommerceRepository>;

    salesRepository = {
      createCoupon: jest.fn(),
      updateCoupon: jest.fn(),
      deleteCoupon: jest.fn(),
      findCouponById: jest.fn(),
      findCouponByCode: jest.fn(),
      listCoupons: jest.fn(),
      incrementCouponUsage: jest.fn(),
    } as unknown as jest.Mocked<ISalesCouponRepository>;

    handler = new CommercePaymentEventHandler(
      eventBus,
      commerceRepository,
      salesRepository,
    );
  });

  it('should subscribe to payment.confirmed on module init', () => {
    handler.onModuleInit();

    expect(eventBus.subscribe).toHaveBeenCalledWith(
      'payment.confirmed',
      expect.any(Function),
      { consumerName: 'commerce-payment-confirmed' },
    );
  });

  it('should publish commerce.order.paid when a commerce payment is confirmed', async () => {
    handler.onModuleInit();

    const callback = eventBus.subscribe.mock.calls.find(
      ([queue]) => queue === 'payment.confirmed',
    )?.[1] as (event: any) => Promise<void>;

    commerceRepository.findOrderByPaymentReference.mockResolvedValue({
      id: 'order-1',
      tenantId: 'tenant-1',
      branchId: null,
      sessionId: 'session-1',
      conversationId: 'conversation-1',
      contactId: 'contact-1',
      status: 'AWAITING_PAYMENT',
      fulfillmentType: 'DELIVERY',
      shippingMode: 'FIXED',
      subtotalAmount: 20,
      freightAmount: 8,
      totalAmount: 28,
      deliveryAddress: 'Rua A, 1',
      paymentReference: 'commerce|tenant-1|order-1',
      paymentLinkId: 'plink-1',
      paymentLinkUrl: 'https://pay.test/plink-1',
      couponCode: null,
      discountAmount: null,
      paymentStatus: 'PENDING',
      paidAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    commerceRepository.markOrderPaidByPaymentReference.mockResolvedValue({
      id: 'order-1',
      tenantId: 'tenant-1',
      branchId: null,
      sessionId: 'session-1',
      conversationId: 'conversation-1',
      contactId: 'contact-1',
      status: 'PAID',
      fulfillmentType: 'DELIVERY',
      shippingMode: 'FIXED',
      subtotalAmount: 20,
      freightAmount: 8,
      totalAmount: 28,
      deliveryAddress: 'Rua A, 1',
      paymentReference: 'commerce|tenant-1|order-1',
      paymentLinkId: 'plink-1',
      paymentLinkUrl: 'https://pay.test/plink-1',
      couponCode: null,
      discountAmount: null,
      paymentStatus: 'PAID',
      paidAt: new Date('2026-04-08T19:00:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await callback({
      payload: {
        tenantId: 'tenant-1',
        amount: 28,
        rawReference: 'commerce|tenant-1|order-1',
        confirmedAt: '2026-04-08T19:00:00.000Z',
      },
    });

    expect(commerceRepository.saveAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        event: 'ORDER_PAID',
        entityId: 'order-1',
      }),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.any(CommerceOrderPaidIntegrationEvent),
    );

    const publishedEvent = eventBus.publish.mock.calls.find(
      ([event]) =>
        event instanceof CommerceOrderPaidIntegrationEvent ||
        (typeof event === 'object' &&
          event != null &&
          'queue' in event &&
          event.queue === 'commerce.order.paid'),
    )?.[0] as CommerceOrderPaidIntegrationEvent | undefined;

    expect(publishedEvent?.payload).toMatchObject({
      orderId: 'order-1',
      tenantId: 'tenant-1',
      totalAmount: 28,
    });
  });
});
