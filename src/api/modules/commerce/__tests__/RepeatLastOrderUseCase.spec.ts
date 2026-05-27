import { NotFoundException } from '@nestjs/common';
import { RepeatLastOrderUseCase } from '../application/use-cases/RepeatLastOrderUseCase';
import {
  CommerceOrderRecord,
  CommerceSessionRecord,
  ICommerceRepository,
} from '../domain/ports/ICommerceRepository';

describe('RepeatLastOrderUseCase', () => {
  let useCase: RepeatLastOrderUseCase;
  let commerceRepository: jest.Mocked<ICommerceRepository>;
  let eventBus: { publish: jest.Mock };

  const tenantId = 'tenant-1';
  const contactId = 'contact-1';
  const conversationId = 'conv-1';
  const branchId = 'branch-1';

  const mockOrder: CommerceOrderRecord = {
    id: 'order-1',
    tenantId,
    branchId,
    sessionId: 'old-session-1',
    conversationId: 'old-conv-1',
    contactId,
    status: 'PAID',
    fulfillmentType: 'DELIVERY',
    shippingMode: 'FIXED',
    subtotalAmount: 50,
    freightAmount: 10,
    totalAmount: 60,
    deliveryAddress: 'Rua X, 123',
    paymentReference: 'ref-1',
    paymentLinkId: null,
    paymentLinkUrl: null,
    couponCode: null,
    discountAmount: null,
    paymentStatus: 'PAID',
    paidAt: new Date(),
    trackingCode: null,
    trackingUrl: null,
    trackingNotifiedAt: null,
    carrier: null,
    carrierServiceName: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockOldSession: CommerceSessionRecord = {
    id: 'old-session-1',
    tenantId,
    branchId,
    conversationId: 'old-conv-1',
    contactId,
    status: 'PAID',
    currentStep: 'PAID',
    fulfillmentType: 'DELIVERY',
    shippingMode: 'FIXED',
    distanceKm: null,
    freightAmount: 10,
    subtotalAmount: 50,
    totalAmount: 60,
    deliveryAddress: 'Rua X, 123',
    notes: null,
    paymentReference: 'ref-1',
    paymentLinkId: null,
    paymentLinkUrl: null,
    paymentStatus: 'PAID',
    abandonmentPaused: false,
    abandonmentPausedAt: null,
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
    checkedOutAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    couponCode: null,
    discountAmount: null,
    items: [
      {
        id: 'item-1',
        sessionId: 'old-session-1',
        tenantId,
        source: 'INVENTORY',
        inventoryItemId: 'inv-1',
        catalogItemId: 'cat-1',
        name: 'Pizza Margherita',
        quantity: 2,
        unitPrice: 15,
        lineTotal: 30,
        currency: 'BRL',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'item-2',
        sessionId: 'old-session-1',
        tenantId,
        source: 'CATALOG',
        inventoryItemId: null,
        catalogItemId: 'cat-2',
        name: 'Refrigerante 2L',
        quantity: 1,
        unitPrice: 20,
        lineTotal: 20,
        currency: 'BRL',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  };

  const mockNewSession: CommerceSessionRecord = {
    id: 'new-session-1',
    tenantId,
    branchId,
    conversationId,
    contactId,
    status: 'BUILDING_CART',
    currentStep: 'ASKING_MORE_ITEMS',
    fulfillmentType: null,
    shippingMode: null,
    distanceKm: null,
    freightAmount: null,
    subtotalAmount: 0,
    totalAmount: 0,
    deliveryAddress: null,
    notes: null,
    paymentReference: null,
    paymentLinkId: null,
    paymentLinkUrl: null,
    paymentStatus: null,
    abandonmentPaused: false,
    abandonmentPausedAt: null,
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
    checkedOutAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    couponCode: null,
    discountAmount: null,
    items: [],
  };

  beforeEach(() => {
    commerceRepository = {
      findOrdersByContact: jest.fn(),
      findSessionById: jest.fn(),
      createSession: jest.fn(),
      addSessionItem: jest.fn(),
      updateSessionState: jest.fn(),
      findActiveSessionByConversation: jest.fn(),
      saveAuditLog: jest.fn(),
      upsertShippingPolicy: jest.fn(),
      findShippingPolicyByTenantId: jest.fn(),
      upsertAbandonmentConfig: jest.fn(),
      findAbandonmentConfigByTenantId: jest.fn(),
      findOrderById: jest.fn(),
      findOrderByPaymentReference: jest.fn(),
      listOrders: jest.fn(),
      updateOrderStatus: jest.fn(),
      markOrderPaidByPaymentReference: jest.fn(),
      updateOrderTracking: jest.fn(),
      createOrder: jest.fn(),
      listAbandonedSessions: jest.fn(),
      listSessionAbandonmentTouches: jest.fn(),
      findCatalogItemById: jest.fn(),
      findInventoryItemById: jest.fn(),
      countActiveCatalogItems: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<ICommerceRepository>;

    eventBus = { publish: jest.fn() };

    useCase = new RepeatLastOrderUseCase(
      commerceRepository,
      eventBus as any,
    );
  });

  it('should create a new session with items from the last paid order', async () => {
    commerceRepository.findOrdersByContact.mockResolvedValue([mockOrder]);
    commerceRepository.findSessionById.mockResolvedValue(mockOldSession);
    commerceRepository.findActiveSessionByConversation.mockResolvedValue(null);
    commerceRepository.createSession.mockResolvedValue(mockNewSession);
    commerceRepository.addSessionItem.mockResolvedValue(
      mockOldSession.items[0],
    );

    const updatedSession = {
      ...mockNewSession,
      subtotalAmount: 50,
      totalAmount: 50,
      items: mockOldSession.items,
    };
    commerceRepository.updateSessionState.mockResolvedValue(updatedSession);

    const result = await useCase.execute({
      tenantId,
      contactId,
      conversationId,
      branchId,
    });

    expect(commerceRepository.findOrdersByContact).toHaveBeenCalledWith(
      tenantId,
      contactId,
      10,
    );
    expect(commerceRepository.findSessionById).toHaveBeenCalledWith(
      tenantId,
      'old-session-1',
    );
    expect(commerceRepository.createSession).toHaveBeenCalledWith({
      tenantId,
      branchId,
      conversationId,
      contactId,
    });
    expect(commerceRepository.addSessionItem).toHaveBeenCalledTimes(2);
    expect(commerceRepository.addSessionItem).toHaveBeenCalledWith({
      sessionId: 'new-session-1',
      tenantId,
      source: 'INVENTORY',
      inventoryItemId: 'inv-1',
      catalogItemId: 'cat-1',
      name: 'Pizza Margherita',
      quantity: 2,
      unitPrice: 15,
      lineTotal: 30,
      currency: 'BRL',
    });
    expect(commerceRepository.addSessionItem).toHaveBeenCalledWith({
      sessionId: 'new-session-1',
      tenantId,
      source: 'CATALOG',
      inventoryItemId: null,
      catalogItemId: 'cat-2',
      name: 'Refrigerante 2L',
      quantity: 1,
      unitPrice: 20,
      lineTotal: 20,
      currency: 'BRL',
    });
    expect(commerceRepository.updateSessionState).toHaveBeenCalledWith({
      tenantId,
      sessionId: 'new-session-1',
      currentStep: 'ASKING_MORE_ITEMS',
      subtotalAmount: 50,
      totalAmount: 50,
    });
    expect(result.session).toEqual(updatedSession);
    expect(result.previousOrderId).toBe('order-1');
    expect(result.itemsCopied).toBe(2);
  });

  it('should throw NotFoundException when contact has no orders', async () => {
    commerceRepository.findOrdersByContact.mockResolvedValue([]);

    await expect(
      useCase.execute({ tenantId, contactId, conversationId }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should skip orders that are not PAID or DELIVERED', async () => {
    const cancelledOrder: CommerceOrderRecord = {
      ...mockOrder,
      status: 'CANCELLED',
    };
    commerceRepository.findOrdersByContact.mockResolvedValue([cancelledOrder]);

    await expect(
      useCase.execute({ tenantId, contactId, conversationId }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw NotFoundException when old session has no items', async () => {
    commerceRepository.findOrdersByContact.mockResolvedValue([mockOrder]);
    commerceRepository.findSessionById.mockResolvedValue({
      ...mockOldSession,
      items: [],
    });

    await expect(
      useCase.execute({ tenantId, contactId, conversationId }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should use existing active session if one exists for the conversation', async () => {
    const existingSession = { ...mockNewSession, id: 'existing-session' };
    commerceRepository.findOrdersByContact.mockResolvedValue([mockOrder]);
    commerceRepository.findSessionById.mockResolvedValue(mockOldSession);
    commerceRepository.findActiveSessionByConversation.mockResolvedValue(
      existingSession,
    );
    commerceRepository.addSessionItem.mockResolvedValue(
      mockOldSession.items[0],
    );

    const updatedSession = {
      ...existingSession,
      subtotalAmount: 50,
      totalAmount: 50,
      items: mockOldSession.items,
    };
    commerceRepository.updateSessionState.mockResolvedValue(updatedSession);

    const result = await useCase.execute({
      tenantId,
      contactId,
      conversationId,
    });

    expect(commerceRepository.createSession).not.toHaveBeenCalled();
    expect(commerceRepository.addSessionItem).toHaveBeenCalledTimes(2);
    expect(result.session.id).toBe('existing-session');
  });

  it('should pick the first PAID or DELIVERED order (most recent)', async () => {
    const deliveredOrder: CommerceOrderRecord = {
      ...mockOrder,
      id: 'order-delivered',
      status: 'DELIVERED',
      sessionId: 'old-session-1',
    };
    const preparingOrder: CommerceOrderRecord = {
      ...mockOrder,
      id: 'order-preparing',
      status: 'PREPARING',
    };

    commerceRepository.findOrdersByContact.mockResolvedValue([
      preparingOrder,
      deliveredOrder,
    ]);
    commerceRepository.findSessionById.mockResolvedValue(mockOldSession);
    commerceRepository.findActiveSessionByConversation.mockResolvedValue(null);
    commerceRepository.createSession.mockResolvedValue(mockNewSession);
    commerceRepository.addSessionItem.mockResolvedValue(
      mockOldSession.items[0],
    );
    commerceRepository.updateSessionState.mockResolvedValue({
      ...mockNewSession,
      subtotalAmount: 50,
      totalAmount: 50,
      items: mockOldSession.items,
    });

    const result = await useCase.execute({
      tenantId,
      contactId,
      conversationId,
    });

    expect(result.previousOrderId).toBe('order-delivered');
  });

  it('should publish CommerceSessionStartedIntegrationEvent for new session', async () => {
    commerceRepository.findOrdersByContact.mockResolvedValue([mockOrder]);
    commerceRepository.findSessionById.mockResolvedValue(mockOldSession);
    commerceRepository.findActiveSessionByConversation.mockResolvedValue(null);
    commerceRepository.createSession.mockResolvedValue(mockNewSession);
    commerceRepository.addSessionItem.mockResolvedValue(
      mockOldSession.items[0],
    );
    commerceRepository.updateSessionState.mockResolvedValue({
      ...mockNewSession,
      subtotalAmount: 50,
      totalAmount: 50,
      items: mockOldSession.items,
    });

    await useCase.execute({ tenantId, contactId, conversationId, branchId });

    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        queue: 'commerce.session.started',
        payload: expect.objectContaining({
          sessionId: 'new-session-1',
          tenantId,
          conversationId,
          contactId,
        }),
      }),
    );
  });

  it('should not publish event when reusing existing session', async () => {
    commerceRepository.findOrdersByContact.mockResolvedValue([mockOrder]);
    commerceRepository.findSessionById.mockResolvedValue(mockOldSession);
    commerceRepository.findActiveSessionByConversation.mockResolvedValue(
      mockNewSession,
    );
    commerceRepository.addSessionItem.mockResolvedValue(
      mockOldSession.items[0],
    );
    commerceRepository.updateSessionState.mockResolvedValue({
      ...mockNewSession,
      subtotalAmount: 50,
      totalAmount: 50,
      items: mockOldSession.items,
    });

    await useCase.execute({ tenantId, contactId, conversationId });

    expect(eventBus.publish).not.toHaveBeenCalled();
  });
});
