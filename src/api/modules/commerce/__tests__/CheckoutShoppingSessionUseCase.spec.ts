import { CheckoutShoppingSessionUseCase } from '../application/use-cases/CheckoutShoppingSessionUseCase';
import { ICommerceRepository } from '../domain/ports/ICommerceRepository';
import { IEventBus } from '@shared/application/ports/IEventBus';
import { ShoppingSessionNotFoundError } from '../domain/errors/ShoppingSessionNotFoundError';
import { InvalidSessionStateError } from '../domain/errors/InvalidSessionStateError';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { CommerceCheckoutCreatedIntegrationEvent } from '../application/integration-events/CheckoutIntegrationEvents';

describe('CheckoutShoppingSessionUseCase', () => {
  let useCase: CheckoutShoppingSessionUseCase;
  let commerceRepo: jest.Mocked<ICommerceRepository>;
  let paymentFacade: any;
  let eventBus: jest.Mocked<IEventBus>;

  const tenantId = 'tenant-1';
  const sessionId = 'session-1';

  const mockSession = {
    id: sessionId,
    tenantId,
    branchId: null,
    conversationId: 'conv-1',
    contactId: 'contact-1',
    status: 'BUILDING_CART' as const,
    currentStep: 'READY_FOR_CHECKOUT' as const,
    fulfillmentType: 'PICKUP' as const,
    shippingMode: null,
    distanceKm: null,
    freightAmount: 0,
    subtotalAmount: 200,
    totalAmount: 200,
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
    items: [
      { id: 'item-1', lineTotal: 100 },
      { id: 'item-2', lineTotal: 100 },
    ],
    couponCode: null,
    discountAmount: null,
  };

  const mockPaymentLink = {
    id: 'link-1',
    url: 'https://pay.example.com/link-1',
  };

  beforeEach(() => {
    commerceRepo = {
      findSessionById: jest.fn(),
      atomicTransitionToCheckingOut: jest.fn().mockResolvedValue(true),
      decrementStockForCheckout: jest.fn().mockResolvedValue(undefined),
      createOrder: jest.fn(),
      updateOrderPaymentLink: jest.fn(),
      updateOrderStatus: jest.fn(),
      updateSessionState: jest.fn(),
      saveAuditLog: jest.fn(),
    } as any;

    paymentFacade = {
      createPaymentLink: jest.fn().mockResolvedValue(mockPaymentLink),
      removePaymentLink: jest.fn().mockResolvedValue(undefined),
    };

    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    } as any;

    useCase = new CheckoutShoppingSessionUseCase(
      commerceRepo,
      paymentFacade,
      eventBus,
    );
  });

  it('should checkout a valid session and create an order', async () => {
    const createdOrder = {
      id: 'order-1',
      tenantId,
      sessionId,
      conversationId: 'conv-1',
      contactId: 'contact-1',
      status: 'AWAITING_PAYMENT',
      fulfillmentType: 'PICKUP',
      shippingMode: null,
      subtotalAmount: 200,
      freightAmount: 0,
      totalAmount: 200,
      paymentReference: 'commerce|tenant-1|order-1',
      paymentLinkId: null,
      paymentLinkUrl: null,
      paymentStatus: 'PENDING',
    };
    commerceRepo.findSessionById.mockResolvedValue(mockSession as any);
    commerceRepo.createOrder.mockResolvedValue(createdOrder as any);
    commerceRepo.updateOrderPaymentLink.mockResolvedValue({
      ...createdOrder,
      paymentLinkId: mockPaymentLink.id,
      paymentLinkUrl: mockPaymentLink.url,
    } as any);
    commerceRepo.updateSessionState.mockResolvedValue({
      ...mockSession,
      status: 'AWAITING_PAYMENT',
    } as any);
    commerceRepo.saveAuditLog.mockResolvedValue(undefined);

    const result = await useCase.execute({ tenantId, sessionId });

    expect(result.order).toBeDefined();
    expect(result.order.paymentLinkId).toBe(mockPaymentLink.id);
    expect(result.paymentLink).toEqual(mockPaymentLink);
    expect(commerceRepo.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        sessionId,
        status: 'AWAITING_PAYMENT',
        paymentLinkId: null,
      }),
    );
    expect(commerceRepo.updateOrderPaymentLink).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        paymentLinkId: mockPaymentLink.id,
        paymentLinkUrl: mockPaymentLink.url,
      }),
    );
  });

  it('should throw ShoppingSessionNotFoundError when session does not exist', async () => {
    commerceRepo.findSessionById.mockResolvedValue(null);

    await expect(
      useCase.execute({ tenantId, sessionId: 'non-existent' }),
    ).rejects.toThrow(ShoppingSessionNotFoundError);
  });

  it('should throw ConflictException when cart is empty', async () => {
    const emptySession = { ...mockSession, items: [] };
    commerceRepo.findSessionById.mockResolvedValue(emptySession as any);

    await expect(useCase.execute({ tenantId, sessionId })).rejects.toThrow(
      ConflictException,
    );
  });

  it('should throw InvalidSessionStateError when session is already paid', async () => {
    const paidSession = { ...mockSession, status: 'PAID' as const };
    commerceRepo.findSessionById.mockResolvedValue(paidSession as any);

    await expect(useCase.execute({ tenantId, sessionId })).rejects.toThrow(
      InvalidSessionStateError,
    );
  });

  it('should calculate totals correctly including freight and discount', async () => {
    const sessionWithFreightAndDiscount = {
      ...mockSession,
      freightAmount: 15,
      discountAmount: 20,
    };
    commerceRepo.findSessionById.mockResolvedValue(
      sessionWithFreightAndDiscount as any,
    );
    commerceRepo.createOrder.mockResolvedValue({ id: 'order-1' } as any);
    commerceRepo.updateOrderPaymentLink.mockResolvedValue({
      id: 'order-1',
    } as any);
    commerceRepo.updateSessionState.mockResolvedValue(
      sessionWithFreightAndDiscount as any,
    );
    commerceRepo.saveAuditLog.mockResolvedValue(undefined);

    await useCase.execute({ tenantId, sessionId });

    // subtotal: 100 + 100 = 200, freight: 15, discount: 20, total: 200 + 15 - 20 = 195
    expect(commerceRepo.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        subtotalAmount: 200,
        freightAmount: 15,
        totalAmount: 195,
      }),
    );
  });

  it('should publish CommerceCheckoutCreatedIntegrationEvent', async () => {
    const checkoutOrder = {
      id: 'order-1',
      tenantId,
      sessionId,
      conversationId: 'conv-1',
      contactId: 'contact-1',
      fulfillmentType: 'PICKUP',
      shippingMode: null,
      subtotalAmount: 200,
      freightAmount: 0,
      totalAmount: 200,
      paymentReference: 'commerce|tenant-1|order-1',
      paymentLinkId: mockPaymentLink.id,
      paymentLinkUrl: mockPaymentLink.url,
    };
    commerceRepo.findSessionById.mockResolvedValue(mockSession as any);
    commerceRepo.createOrder.mockResolvedValue({
      ...checkoutOrder,
      paymentLinkId: null,
      paymentLinkUrl: null,
    } as any);
    commerceRepo.updateOrderPaymentLink.mockResolvedValue(
      checkoutOrder as any,
    );
    commerceRepo.updateSessionState.mockResolvedValue(mockSession as any);
    commerceRepo.saveAuditLog.mockResolvedValue(undefined);

    await useCase.execute({ tenantId, sessionId });

    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.any(CommerceCheckoutCreatedIntegrationEvent),
    );
  });

  it('should cancel the order when payment link creation fails', async () => {
    commerceRepo.findSessionById.mockResolvedValue(mockSession as any);
    commerceRepo.createOrder.mockResolvedValue({
      id: 'order-1',
      tenantId,
      sessionId,
    } as any);
    commerceRepo.updateOrderStatus.mockResolvedValue({ id: 'order-1' } as any);
    commerceRepo.saveAuditLog.mockResolvedValue(undefined);
    const failure = new Error('gateway down');
    paymentFacade.createPaymentLink.mockRejectedValue(failure);

    await expect(useCase.execute({ tenantId, sessionId })).rejects.toThrow(
      failure,
    );

    expect(commerceRepo.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'AWAITING_PAYMENT' }),
    );
    expect(commerceRepo.updateOrderStatus).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId, status: 'CANCELLED' }),
    );
    expect(commerceRepo.updateOrderPaymentLink).not.toHaveBeenCalled();
  });

  it('should throw BadRequestException when fulfillmentType is not set', async () => {
    const noFulfillment = { ...mockSession, fulfillmentType: null };
    commerceRepo.findSessionById.mockResolvedValue(noFulfillment as any);

    await expect(useCase.execute({ tenantId, sessionId })).rejects.toThrow(
      BadRequestException,
    );
  });
});
