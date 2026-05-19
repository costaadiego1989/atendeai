import { IEventBus } from '@shared/application/ports/IEventBus';
import { ICommerceRepository } from '../domain/ports/ICommerceRepository';
import { TriggerCommerceAbandonmentTouchUseCase } from '../application/use-cases/TriggerCommerceAbandonmentTouchUseCase';
import { CommerceSessionAbandonedIntegrationEvent } from '../application/integration-events/CheckoutIntegrationEvents';

describe('TriggerCommerceAbandonmentTouchUseCase', () => {
  let useCase: TriggerCommerceAbandonmentTouchUseCase;
  let commerceRepository: jest.Mocked<ICommerceRepository>;
  let eventBus: jest.Mocked<IEventBus>;

  beforeEach(() => {
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
      listAbandonedSessions: jest.fn(),
      listSessionAbandonmentTouches: jest.fn(),
      findCatalogItemById: jest.fn(),
      findInventoryItemById: jest.fn(),
      countActiveCatalogItems: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<ICommerceRepository>;

    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn(),
    };

    useCase = new TriggerCommerceAbandonmentTouchUseCase(
      commerceRepository,
      eventBus,
    );
  });

  it('should publish a manual abandonment touch for the order session', async () => {
    commerceRepository.findOrderById.mockResolvedValue({
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
      trackingCode: null,
      trackingUrl: null,
      trackingNotifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    commerceRepository.findSessionById.mockResolvedValue({
      id: 'session-1',
      tenantId: 'tenant-1',
      branchId: null,
      conversationId: 'conversation-1',
      contactId: 'contact-1',
      status: 'AWAITING_PAYMENT',
      currentStep: 'AWAITING_PAYMENT',
      fulfillmentType: 'DELIVERY',
      shippingMode: 'FIXED',
      distanceKm: null,
      freightAmount: 8,
      subtotalAmount: 20,
      totalAmount: 28,
      deliveryAddress: 'Rua A, 1',
      notes: null,
      paymentReference: 'commerce|tenant-1|order-1',
      paymentLinkId: 'plink-1',
      paymentLinkUrl: 'https://pay.test/plink-1',
      paymentStatus: 'PENDING',
      abandonmentPaused: false,
      abandonmentPausedAt: null,
      couponCode: null,
      discountAmount: null,
      pendingQuery: null,
      pendingOptions: [],
      selectedSource: null,
      selectedInventoryItemId: null,
      selectedCatalogItemId: null,
      selectedItemName: null,
      checkedOutAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
    });

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      orderId: 'order-1',
      userId: '00000000-0000-0000-0000-000000000001',
      userName: 'Operação',
    });

    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.any(CommerceSessionAbandonedIntegrationEvent),
    );
    expect(commerceRepository.saveAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'SESSION_ABANDONMENT_TRIGGERED',
        entityId: 'session-1',
        metadata: expect.objectContaining({
          interval: 'manual',
          manual: true,
        }),
      }),
    );
    expect(result.interval).toBe('manual');
  });
});
