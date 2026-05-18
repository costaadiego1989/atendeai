import { OrderTrackingNotificationHandler } from '../application/handlers/OrderTrackingNotificationHandler';
import { ICommerceRepository, CommerceOrderRecord } from '../domain/ports/ICommerceRepository';
import { IEventBus } from '@shared/application/ports/IEventBus';
import { IMessagingFacade } from '@modules/messaging/application/facades/MessagingFacade';

describe('OrderTrackingNotificationHandler', () => {
  let handler: OrderTrackingNotificationHandler;
  let eventBus: jest.Mocked<IEventBus>;
  let messagingFacade: jest.Mocked<IMessagingFacade>;
  let commerceRepository: jest.Mocked<ICommerceRepository>;
  let subscribedCallback: (event: any) => Promise<void>;

  const baseOrder: CommerceOrderRecord = {
    id: 'order-1',
    tenantId: 'tenant-1',
    branchId: 'branch-1',
    sessionId: 'session-1',
    conversationId: 'conv-1',
    contactId: 'contact-1',
    status: 'OUT_FOR_DELIVERY',
    fulfillmentType: 'DELIVERY',
    shippingMode: 'FIXED',
    subtotalAmount: 100,
    freightAmount: 10,
    totalAmount: 110,
    deliveryAddress: 'Rua A, 123',
    paymentReference: 'ref-1',
    paymentLinkId: null,
    paymentLinkUrl: null,
    couponCode: null,
    discountAmount: null,
    paymentStatus: 'PAID',
    paidAt: new Date(),
    trackingCode: 'BR123456789',
    trackingUrl: 'https://track.com/BR123456789',
    trackingNotifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    eventBus = {
      publish: jest.fn(),
      subscribe: jest.fn((eventName, callback) => {
        subscribedCallback = callback;
      }),
    } as any;
    messagingFacade = {
      queueSystemMessage: jest.fn().mockResolvedValue({
        conversationId: 'conv-1',
        messageId: 'msg-1',
      }),
    } as any;
    commerceRepository = {
      findOrderById: jest.fn(),
      updateOrderTracking: jest.fn(),
    } as any;

    handler = new OrderTrackingNotificationHandler(
      eventBus,
      messagingFacade,
      commerceRepository,
    );
    handler.onModuleInit();
  });

  it('should subscribe to commerce.order.tracking-set event', () => {
    expect(eventBus.subscribe).toHaveBeenCalledWith(
      'commerce.order.tracking-set',
      expect.any(Function),
      { consumerName: 'commerce-order-tracking-notification' },
    );
  });

  it('should send WhatsApp notification with tracking code and URL', async () => {
    commerceRepository.findOrderById.mockResolvedValue(baseOrder);

    await subscribedCallback({
      payload: {
        orderId: 'order-1',
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        trackingCode: 'BR123456789',
        trackingUrl: 'https://track.com/BR123456789',
      },
    });

    expect(messagingFacade.queueSystemMessage).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      channel: 'WHATSAPP',
      text: expect.stringContaining('BR123456789'),
      branchId: 'branch-1',
    });
    expect(messagingFacade.queueSystemMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('https://track.com/BR123456789'),
      }),
    );
  });

  it('should send notification without URL when trackingUrl is null', async () => {
    const orderWithoutUrl = { ...baseOrder, trackingUrl: null };
    commerceRepository.findOrderById.mockResolvedValue(orderWithoutUrl);

    await subscribedCallback({
      payload: {
        orderId: 'order-1',
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        trackingCode: 'BR123456789',
        trackingUrl: null,
      },
    });

    expect(messagingFacade.queueSystemMessage).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      channel: 'WHATSAPP',
      text: expect.stringContaining('BR123456789'),
      branchId: 'branch-1',
    });
    const callText = (messagingFacade.queueSystemMessage.mock.calls[0][0] as any).text;
    expect(callText).not.toContain('Acompanhe aqui');
  });

  it('should not send notification when contactId is null', async () => {
    await subscribedCallback({
      payload: {
        orderId: 'order-1',
        tenantId: 'tenant-1',
        contactId: null,
        trackingCode: 'BR123456789',
        trackingUrl: null,
      },
    });

    expect(messagingFacade.queueSystemMessage).not.toHaveBeenCalled();
  });

  it('should not send notification when order is not found', async () => {
    commerceRepository.findOrderById.mockResolvedValue(null);

    await subscribedCallback({
      payload: {
        orderId: 'order-1',
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        trackingCode: 'BR123456789',
        trackingUrl: null,
      },
    });

    expect(messagingFacade.queueSystemMessage).not.toHaveBeenCalled();
  });

  it('should use null branchId when order has no branch', async () => {
    commerceRepository.findOrderById.mockResolvedValue({ ...baseOrder, branchId: null });

    await subscribedCallback({
      payload: {
        orderId: 'order-1',
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        trackingCode: 'BR123456789',
        trackingUrl: null,
      },
    });

    expect(messagingFacade.queueSystemMessage).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: null }),
    );
  });

  it('should not throw when messaging facade fails (graceful degradation)', async () => {
    commerceRepository.findOrderById.mockResolvedValue(baseOrder);
    messagingFacade.queueSystemMessage.mockRejectedValue(new Error('Queue unavailable'));

    await expect(
      subscribedCallback({
        payload: {
          orderId: 'order-1',
          tenantId: 'tenant-1',
          contactId: 'contact-1',
          trackingCode: 'BR123456789',
          trackingUrl: null,
        },
      }),
    ).resolves.not.toThrow();
  });
});
