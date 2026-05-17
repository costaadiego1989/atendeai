import { UpdateShoppingSessionFulfillmentUseCase } from '../application/use-cases/UpdateShoppingSessionFulfillmentUseCase';
import { ICommerceRepository } from '../domain/ports/ICommerceRepository';
import { ISalesCouponRepository } from '@modules/sales/domain/repositories/ISalesRepository';

describe('UpdateShoppingSessionFulfillmentUseCase', () => {
  let useCase: UpdateShoppingSessionFulfillmentUseCase;
  let commerceRepo: jest.Mocked<ICommerceRepository>;
  let salesRepo: jest.Mocked<ISalesCouponRepository>;

  const tenantId = 'tenant-1';
  const sessionId = 'session-1';

  beforeEach(() => {
    commerceRepo = {
      findSessionById: jest.fn(),
      findShippingPolicyByTenantId: jest.fn(),
      updateSessionState: jest.fn(),
    } as any;

    salesRepo = {
      findCouponByCode: jest.fn(),
    } as any;

    // UseCase takes commerceRepo and salesRepo (to be added)
    useCase = new UpdateShoppingSessionFulfillmentUseCase(
      commerceRepo,
      salesRepo,
    );
  });

  it('should recalculate total with coupon when fulfillment type changes to delivery', async () => {
    const sessionWithCoupon = {
      id: sessionId,
      tenantId,
      subtotalAmount: 100,
      freightAmount: 0,
      fulfillmentType: 'PICKUP',
      couponCode: 'PCT10',
      discountAmount: 10,
      totalAmount: 90,
      items: [{ lineTotal: 100 }],
    };

    commerceRepo.findSessionById.mockResolvedValue(sessionWithCoupon as any);

    commerceRepo.findShippingPolicyByTenantId.mockResolvedValue({
      mode: 'FIXED',
      fixedAmount: 15,
      active: true,
    } as any);

    salesRepo.findCouponByCode.mockResolvedValue({
      code: 'PCT10',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      active: true,
      startsAt: new Date(2000, 1, 1),
    } as any);

    const updatedSession = { id: sessionId };
    commerceRepo.updateSessionState.mockResolvedValue(updatedSession as any);

    await useCase.execute({
      tenantId,
      sessionId,
      fulfillmentType: 'DELIVERY',
      deliveryAddress: 'Main St 123',
    });

    // Subtotal: 100
    // Freight: 15
    // Discount (10% of 100): 10
    // Total: 100 + 15 - 10 = 105
    expect(commerceRepo.updateSessionState).toHaveBeenCalledWith(
      expect.objectContaining({
        fulfillmentType: 'DELIVERY',
        freightAmount: 15,
        discountAmount: 10,
        totalAmount: 105,
      }),
    );
  });
});
