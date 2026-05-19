import { AIResponseProcessor } from '../../ai/application/services/AIResponseProcessor';
import { IPaymentLinkGenerator } from '../../ai/application/ports/IPaymentLinkGenerator';
import { IRepeatLastOrder } from '../../ai/application/ports/IRepeatLastOrder';
import { RepeatLastOrderUseCase } from '../application/use-cases/RepeatLastOrderUseCase';
import {
  ICommerceRepository,
  CommerceOrderRecord,
  CommerceSessionRecord,
  CommerceSessionItemRecord,
} from '../domain/ports/ICommerceRepository';
import { NotFoundException } from '@nestjs/common';

/**
 * Integration test: RepeatLastOrder + AIResponseProcessor
 * Validates the full flow from AI placeholder to cart creation.
 */
describe('RepeatLastOrder Integration', () => {
  let processor: AIResponseProcessor;
  let repeatLastOrderUseCase: RepeatLastOrderUseCase;
  let commerceRepository: jest.Mocked<ICommerceRepository>;
  let eventBus: { publish: jest.Mock };
  let paymentLinkGenerator: jest.Mocked<IPaymentLinkGenerator>;

  const tenantId = 'tenant-int-1';
  const contactId = 'contact-int-1';
  const conversationId = 'conv-int-1';
  const branchId = 'branch-int-1';

  const mockItems: CommerceSessionItemRecord[] = [
    {
      id: 'item-1',
      sessionId: 'old-session-1',
      tenantId,
      source: 'INVENTORY',
      inventoryItemId: 'inv-1',
      catalogItemId: 'cat-1',
      name: 'X-Burger',
      quantity: 2,
      unitPrice: 25,
      lineTotal: 50,
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
      name: 'Batata Frita G',
      quantity: 1,
      unitPrice: 18,
      lineTotal: 18,
      currency: 'BRL',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockOrder: CommerceOrderRecord = {
    id: 'order-int-1',
    tenantId,
    branchId,
    sessionId: 'old-session-1',
    conversationId: 'old-conv-1',
    contactId,
    status: 'DELIVERED',
    fulfillmentType: 'DELIVERY',
    shippingMode: 'FIXED',
    subtotalAmount: 68,
    freightAmount: 8,
    totalAmount: 76,
    deliveryAddress: 'Rua Y, 456',
    paymentReference: 'ref-int-1',
    paymentLinkId: null,
    paymentLinkUrl: null,
    couponCode: null,
    discountAmount: null,
    paymentStatus: 'PAID',
    paidAt: new Date(),
    trackingCode: 'BR123456789',
    trackingUrl: 'https://rastreio.correios.com.br/BR123456789',
    trackingNotifiedAt: new Date(),
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
    freightAmount: 8,
    subtotalAmount: 68,
    totalAmount: 76,
    deliveryAddress: 'Rua Y, 456',
    notes: null,
    paymentReference: 'ref-int-1',
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
    checkedOutAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    couponCode: null,
    discountAmount: null,
    items: mockItems,
  };

  const mockNewSession: CommerceSessionRecord = {
    id: 'new-session-int-1',
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
    subtotalAmount: 68,
    totalAmount: 68,
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
    checkedOutAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    couponCode: null,
    discountAmount: null,
    items: mockItems,
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
    } as unknown as jest.Mocked<ICommerceRepository>;

    eventBus = { publish: jest.fn() };
    paymentLinkGenerator = { generate: jest.fn() };

    repeatLastOrderUseCase = new RepeatLastOrderUseCase(
      commerceRepository,
      eventBus as any,
    );

    processor = new AIResponseProcessor(
      paymentLinkGenerator,
      undefined,
      repeatLastOrderUseCase,
    );
  });

  it('should process [REPEAT_LAST_ORDER] placeholder end-to-end and return formatted cart', async () => {
    commerceRepository.findOrdersByContact.mockResolvedValue([mockOrder]);
    commerceRepository.findSessionById.mockResolvedValue(mockOldSession);
    commerceRepository.findActiveSessionByConversation.mockResolvedValue(null);
    commerceRepository.createSession.mockResolvedValue({
      ...mockNewSession,
      subtotalAmount: 0,
      totalAmount: 0,
      items: [],
    });
    commerceRepository.addSessionItem.mockResolvedValue(mockItems[0]);
    commerceRepository.updateSessionState.mockResolvedValue(mockNewSession);

    const aiResponse =
      'Vou repetir seu último pedido agora! [REPEAT_LAST_ORDER]';

    const result = await processor.process(aiResponse, {
      tenantId,
      branchId,
      contactId,
      conversationId,
    });

    // Verify cart was created
    expect(commerceRepository.findOrdersByContact).toHaveBeenCalledWith(
      tenantId,
      contactId,
      10,
    );
    expect(commerceRepository.createSession).toHaveBeenCalledWith({
      tenantId,
      branchId,
      conversationId,
      contactId,
    });
    expect(commerceRepository.addSessionItem).toHaveBeenCalledTimes(2);

    // Verify response contains item names and subtotal
    expect(result).toContain('X-Burger');
    expect(result).toContain('Batata Frita G');
    expect(result).toContain('R$ 68.00');
    expect(result).toContain('Deseja adicionar mais algum item');
    expect(result).not.toContain('[REPEAT_LAST_ORDER]');
  });

  it('should show fallback when contact has no previous orders', async () => {
    commerceRepository.findOrdersByContact.mockResolvedValue([]);

    const aiResponse = 'Repetindo pedido. [REPEAT_LAST_ORDER]';

    const result = await processor.process(aiResponse, {
      tenantId,
      branchId,
      contactId,
      conversationId,
    });

    expect(result).toContain('Não consegui repetir seu pedido anterior');
    expect(result).not.toContain('[REPEAT_LAST_ORDER]');
  });

  it('should handle tracking code in order context (verifies Fase 2 data is available)', async () => {
    // This test verifies that orders returned by findOrdersByContact
    // include tracking data from Fase 2
    commerceRepository.findOrdersByContact.mockResolvedValue([mockOrder]);

    const orders = await commerceRepository.findOrdersByContact(
      tenantId,
      contactId,
      10,
    );

    expect(orders[0].trackingCode).toBe('BR123456789');
    expect(orders[0].trackingUrl).toBe(
      'https://rastreio.correios.com.br/BR123456789',
    );
    expect(orders[0].trackingNotifiedAt).toBeInstanceOf(Date);
  });

  it('should process both [PAYMENT_LINK] and [REPEAT_LAST_ORDER] in same response', async () => {
    commerceRepository.findOrdersByContact.mockResolvedValue([mockOrder]);
    commerceRepository.findSessionById.mockResolvedValue(mockOldSession);
    commerceRepository.findActiveSessionByConversation.mockResolvedValue(null);
    commerceRepository.createSession.mockResolvedValue({
      ...mockNewSession,
      subtotalAmount: 0,
      totalAmount: 0,
      items: [],
    });
    commerceRepository.addSessionItem.mockResolvedValue(mockItems[0]);
    commerceRepository.updateSessionState.mockResolvedValue(mockNewSession);
    paymentLinkGenerator.generate.mockResolvedValue({
      id: 'link-1',
      url: 'https://pay.test/link-1',
    });

    const aiResponse =
      'Repetindo: [REPEAT_LAST_ORDER] E aqui o pagamento: [PAYMENT_LINK: Pedido, 68.00]';

    const result = await processor.process(aiResponse, {
      tenantId,
      branchId,
      contactId,
      conversationId,
    });

    expect(result).toContain('X-Burger');
    expect(result).toContain('https://pay.test/link-1');
    expect(result).not.toContain('[REPEAT_LAST_ORDER]');
    expect(result).not.toContain('[PAYMENT_LINK');
  });
});
