import { IEventBus } from '@shared/application/ports/IEventBus';
import { ICommerceRepository } from '../domain/ports/ICommerceRepository';
import { DetectAbandonedShoppingSessionsUseCase } from '../application/use-cases/DetectAbandonedShoppingSessionsUseCase';
import { CommerceSessionAbandonedIntegrationEvent } from '../application/integration-events/CheckoutIntegrationEvents';

describe('DetectAbandonedShoppingSessionsUseCase', () => {
  let useCase: DetectAbandonedShoppingSessionsUseCase;
  let eventBus: jest.Mocked<IEventBus>;
  let commerceRepository: jest.Mocked<ICommerceRepository>;

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
      listAbandonedSessions: jest.fn(),
      findCatalogItemById: jest.fn(),
      findInventoryItemById: jest.fn(),
      countActiveCatalogItems: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<ICommerceRepository>;

    useCase = new DetectAbandonedShoppingSessionsUseCase(
      commerceRepository,
      eventBus,
    );
  });

  it('should publish abandonment events and audit them by interval', async () => {
    commerceRepository.listAbandonedSessions
      .mockResolvedValueOnce([
        {
          id: 'session-1',
          tenantId: 'tenant-1',
          conversationId: 'conversation-1',
          contactId: 'contact-1',
          status: 'BUILDING_CART',
          currentStep: 'ASKING_MORE_ITEMS',
          fulfillmentType: null,
          shippingMode: null,
          distanceKm: null,
          freightAmount: null,
          subtotalAmount: 20,
          totalAmount: 20,
          deliveryAddress: null,
          notes: null,
          paymentReference: null,
          paymentLinkId: null,
          paymentLinkUrl: null,
          paymentStatus: null,
          pendingQuery: null,
          pendingOptions: [],
          selectedSource: null,
          selectedInventoryItemId: null,
          selectedCatalogItemId: null,
          selectedItemName: null,
          carrierCep: null,
          carrierServiceCode: null,
          carrierServiceName: null,
          carrierDeliveryDays: null,
          branchId: null,
          abandonmentPaused: false,
          abandonmentPausedAt: null,
          couponCode: null,
          discountAmount: null,
          checkedOutAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          items: [],
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'session-2',
          tenantId: 'tenant-2',
          conversationId: 'conversation-2',
          contactId: null,
          status: 'READY_FOR_CHECKOUT',
          currentStep: 'READY_FOR_CHECKOUT',
          fulfillmentType: 'PICKUP',
          shippingMode: null,
          distanceKm: null,
          freightAmount: 0,
          subtotalAmount: 45,
          totalAmount: 45,
          deliveryAddress: null,
          notes: null,
          paymentReference: null,
          paymentLinkId: null,
          paymentLinkUrl: null,
          paymentStatus: null,
          pendingQuery: null,
          pendingOptions: [],
          selectedSource: null,
          selectedInventoryItemId: null,
          selectedCatalogItemId: null,
          selectedItemName: null,
          carrierCep: null,
          carrierServiceCode: null,
          carrierServiceName: null,
          carrierDeliveryDays: null,
          branchId: null,
          abandonmentPaused: false,
          abandonmentPausedAt: null,
          couponCode: null,
          discountAmount: null,
          checkedOutAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          items: [],
        },
      ]);

    const now = new Date('2026-04-08T21:00:00.000Z');
    const result = await useCase.execute({ now, limitPerInterval: 20 });

    expect(commerceRepository.listAbandonedSessions).toHaveBeenNthCalledWith(
      1,
      {
        interval: '1h',
        staleBefore: new Date('2026-04-08T20:00:00.000Z'),
        limit: 20,
      },
    );
    expect(commerceRepository.listAbandonedSessions).toHaveBeenNthCalledWith(
      2,
      {
        interval: '1d',
        staleBefore: new Date('2026-04-07T21:00:00.000Z'),
        limit: 20,
      },
    );
    expect(commerceRepository.listAbandonedSessions).toHaveBeenNthCalledWith(
      3,
      {
        interval: '7d',
        staleBefore: new Date('2026-04-01T21:00:00.000Z'),
        limit: 20,
      },
    );

    expect(eventBus.publish).toHaveBeenCalledTimes(2);
    expect(eventBus.publish).toHaveBeenNthCalledWith(
      1,
      expect.any(CommerceSessionAbandonedIntegrationEvent),
    );
    expect(eventBus.publish).toHaveBeenNthCalledWith(
      2,
      expect.any(CommerceSessionAbandonedIntegrationEvent),
    );
    expect(commerceRepository.saveAuditLog).toHaveBeenCalledTimes(2);
    expect(result.triggered).toEqual([
      { sessionId: 'session-1', tenantId: 'tenant-1', interval: '1h' },
      { sessionId: 'session-2', tenantId: 'tenant-2', interval: '7d' },
    ]);
  });
});
