import { ConflictException } from '@nestjs/common';
import { IEventBus } from '@shared/application/ports/IEventBus';
import { ICommerceRepository } from '../domain/ports/ICommerceRepository';
import { UpdateCommerceOrderStatusUseCase } from '../application/use-cases/UpdateCommerceOrderStatusUseCase';
import {
  CommerceOrderCancelledIntegrationEvent,
  CommerceOrderDeliveredIntegrationEvent,
  CommerceOrderPreparingIntegrationEvent,
  CommerceOrderReadyForPickupIntegrationEvent,
  CommerceOrderShippedIntegrationEvent,
} from '../application/integration-events/CheckoutIntegrationEvents';

describe('UpdateCommerceOrderStatusUseCase', () => {
  let useCase: UpdateCommerceOrderStatusUseCase;
  let eventBus: jest.Mocked<IEventBus>;
  let commerceRepository: jest.Mocked<ICommerceRepository>;

  const baseOrder = {
    id: 'order-1',
    tenantId: 'tenant-1',
    branchId: null,
    sessionId: 'session-1',
    conversationId: 'conversation-1',
    contactId: 'contact-1',
    status: 'PAID' as const,
    fulfillmentType: 'DELIVERY' as const,
    shippingMode: 'FIXED' as const,
    subtotalAmount: 20,
    freightAmount: 8,
    discountAmount: 0,
    totalAmount: 28,
    couponCode: null,
    deliveryAddress: 'Rua A, 1',
    paymentReference: 'commerce|tenant-1|order-1',
    paymentLinkId: 'plink-1',
    paymentLinkUrl: 'https://pay.test/plink-1',
    paymentStatus: 'PAID' as const,
    paidAt: new Date('2026-04-08T19:00:00.000Z'),
    trackingCode: null,
    trackingUrl: null,
    trackingNotifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

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
      countActiveCatalogItems: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<ICommerceRepository>;

    useCase = new UpdateCommerceOrderStatusUseCase(
      commerceRepository,
      eventBus,
    );
  });

  it.each([
    ['PREPARING', CommerceOrderPreparingIntegrationEvent],
    ['READY_FOR_PICKUP', CommerceOrderReadyForPickupIntegrationEvent],
    ['OUT_FOR_DELIVERY', CommerceOrderShippedIntegrationEvent],
    ['DELIVERED', CommerceOrderDeliveredIntegrationEvent],
    ['CANCELLED', CommerceOrderCancelledIntegrationEvent],
  ] as const)(
    'should publish the correct event when moving order to %s',
    async (nextStatus, EventClass) => {
      commerceRepository.findOrderById.mockResolvedValue(baseOrder);
      commerceRepository.updateOrderStatus.mockResolvedValue({
        ...baseOrder,
        status: nextStatus,
      });

      const result = await useCase.execute({
        tenantId: 'tenant-1',
        orderId: 'order-1',
        status: nextStatus,
        userId: 'user-1',
        userName: 'Operator',
      });

      expect(result.status).toBe(nextStatus);
      expect(commerceRepository.saveAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          event: 'ORDER_STATUS_CHANGED',
          entityId: 'order-1',
        }),
      );
      expect(eventBus.publish).toHaveBeenCalledWith(expect.any(EventClass));
    },
  );

  it('should reject invalid transitions', async () => {
    commerceRepository.findOrderById.mockResolvedValue({
      ...baseOrder,
      status: 'AWAITING_PAYMENT',
      paymentStatus: 'PENDING',
      paidAt: null,
    });

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        orderId: 'order-1',
        status: 'PREPARING',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(commerceRepository.updateOrderStatus).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });
});
