import { GetCommerceOrderDetailsUseCase } from '../application/use-cases/GetCommerceOrderDetailsUseCase';
import { ICommerceRepository } from '../domain/ports/ICommerceRepository';
import { NotFoundException } from '@nestjs/common';

describe('GetCommerceOrderDetailsUseCase', () => {
  let useCase: GetCommerceOrderDetailsUseCase;
  let commerceRepo: jest.Mocked<ICommerceRepository>;

  const tenantId = 'tenant-1';
  const orderId = 'order-1';

  const mockOrder = {
    id: orderId,
    tenantId,
    branchId: null,
    sessionId: 'session-1',
    conversationId: 'conv-1',
    contactId: 'contact-1',
    status: 'PAID' as const,
    fulfillmentType: 'DELIVERY' as const,
    shippingMode: 'FIXED' as const,
    subtotalAmount: 200,
    freightAmount: 15,
    totalAmount: 215,
    deliveryAddress: 'Rua Exemplo, 123',
    paymentReference: 'commerce|tenant-1|order-1',
    paymentLinkId: 'link-1',
    paymentLinkUrl: 'https://pay.example.com/link-1',
    couponCode: null,
    discountAmount: null,
    paymentStatus: 'PAID' as const,
    paidAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSession = {
    id: 'session-1',
    tenantId,
    items: [
      { id: 'item-1', name: 'Product A', quantity: 2, lineTotal: 100 },
      { id: 'item-2', name: 'Product B', quantity: 1, lineTotal: 100 },
    ],
  };

  const mockAbandonmentTouches = [
    {
      interval: '60min',
      triggeredAt: new Date(),
      subtotalAmount: 200,
      totalAmount: 215,
      currentStep: 'READY_FOR_CHECKOUT',
    },
  ];

  beforeEach(() => {
    commerceRepo = {
      findOrderById: jest.fn(),
      findSessionById: jest.fn(),
      listSessionAbandonmentTouches: jest.fn(),
    } as any;

    useCase = new GetCommerceOrderDetailsUseCase(commerceRepo);
  });

  it('should return order with session and abandonment touches', async () => {
    commerceRepo.findOrderById.mockResolvedValue(mockOrder as any);
    commerceRepo.findSessionById.mockResolvedValue(mockSession as any);
    commerceRepo.listSessionAbandonmentTouches.mockResolvedValue(
      mockAbandonmentTouches as any,
    );

    const result = await useCase.execute(tenantId, orderId);

    expect(result.order).toEqual(mockOrder);
    expect(result.session).toEqual(mockSession);
    expect(result.abandonmentTouches).toEqual(mockAbandonmentTouches);
  });

  it('should throw NotFoundException when order is not found', async () => {
    commerceRepo.findOrderById.mockResolvedValue(null);

    await expect(useCase.execute(tenantId, 'non-existent')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should ensure tenant isolation by passing tenantId to repository', async () => {
    const otherTenantId = 'tenant-2';
    commerceRepo.findOrderById.mockResolvedValue(null);

    await expect(useCase.execute(otherTenantId, orderId)).rejects.toThrow(
      NotFoundException,
    );
    expect(commerceRepo.findOrderById).toHaveBeenCalledWith(
      otherTenantId,
      orderId,
    );
  });

  it('should include payment status in the returned order', async () => {
    commerceRepo.findOrderById.mockResolvedValue(mockOrder as any);
    commerceRepo.findSessionById.mockResolvedValue(mockSession as any);
    commerceRepo.listSessionAbandonmentTouches.mockResolvedValue([]);

    const result = await useCase.execute(tenantId, orderId);

    expect(result.order.paymentStatus).toBe('PAID');
    expect(result.order.paidAt).toBeDefined();
  });
});
