import { AddItemToShoppingSessionUseCase } from '../application/use-cases/AddItemToShoppingSessionUseCase';
import { ICommerceRepository } from '../domain/ports/ICommerceRepository';
import { IEventBus } from '@shared/application/ports/IEventBus';
import { ISalesCouponRepository } from '@modules/sales/domain/repositories/ISalesRepository';

describe('AddItemToShoppingSessionUseCase', () => {
  let useCase: AddItemToShoppingSessionUseCase;
  let commerceRepo: jest.Mocked<ICommerceRepository>;
  let salesRepo: jest.Mocked<ISalesCouponRepository>;
  let eventBus: jest.Mocked<IEventBus>;

  const tenantId = 'tenant-1';
  const sessionId = 'session-1';

  beforeEach(() => {
    commerceRepo = {
      findSessionById: jest.fn(),
      findCatalogItemById: jest.fn(),
      addSessionItem: jest.fn(),
      updateSessionState: jest.fn(),
    } as any;

    salesRepo = {
      findCouponByCode: jest.fn(),
    } as any;

    eventBus = {
      publish: jest.fn(),
    } as any;

    useCase = new AddItemToShoppingSessionUseCase(commerceRepo, salesRepo, eventBus);
  });

  it('should recalculate percentage discount when a new item is added', async () => {
    // 1. Session specifically has a 10% coupon already applied
    const sessionWithCoupon = {
      id: sessionId,
      tenantId,
      subtotalAmount: 100,
      freightAmount: 0,
      couponCode: 'PCT10',
      discountAmount: 10,
      totalAmount: 90,
      conversationId: 'conv-1',
      contactId: 'contact-1',
      items: [{ lineTotal: 100 }],
    };

    commerceRepo.findSessionById.mockResolvedValueOnce(sessionWithCoupon as any);
    
    // Mock item finding
    commerceRepo.findCatalogItemById.mockResolvedValue({
      id: 'item-2',
      name: 'New Item',
      basePrice: 50,
      currency: 'BRL',
    } as any);

    commerceRepo.addSessionItem.mockResolvedValue({
      name: 'New Item',
      quantity: 1,
      unitPrice: 50,
      lineTotal: 50,
    } as any);

    // After adding item, refreshed session has new subtotal
    const refreshedSession = {
      ...sessionWithCoupon,
      items: [{ lineTotal: 100 }, { lineTotal: 50 }],
    };
    commerceRepo.findSessionById.mockResolvedValueOnce(refreshedSession as any);

    salesRepo.findCouponByCode.mockResolvedValue({
      code: 'PCT10',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      active: true,
      startsAt: new Date(2000, 1, 1),
    } as any);

    const updatedSession = {
      ...refreshedSession,
      subtotalAmount: 150,
      discountAmount: 15,
      totalAmount: 135,
    };
    commerceRepo.updateSessionState.mockResolvedValue(updatedSession as any);

    await useCase.execute({
      tenantId,
      sessionId,
      catalogItemId: 'item-2',
      quantity: 1,
    });

    // Subtotal: 100 + 50 = 150
    // Discount (10%): 15
    // Total: 150 - 15 = 135
    expect(commerceRepo.updateSessionState).toHaveBeenCalledWith(expect.objectContaining({
      subtotalAmount: 150,
      discountAmount: 15,
      totalAmount: 135,
    }));
  });
});
