import { AddItemToShoppingSessionUseCase } from '../application/use-cases/AddItemToShoppingSessionUseCase';
import { ICommerceRepository } from '../domain/ports/ICommerceRepository';
import { IEventBus } from '@shared/application/ports/IEventBus';
import { ISalesFacade } from '@modules/sales/application/facades/ISalesFacade';

describe('AddItemToShoppingSessionUseCase', () => {
  let useCase: AddItemToShoppingSessionUseCase;
  let commerceRepo: jest.Mocked<ICommerceRepository>;
  let salesFacade: jest.Mocked<ISalesFacade>;
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

    salesFacade = {
      findCouponByCode: jest.fn(),
      incrementCouponUsage: jest.fn(),
    } as any;

    eventBus = {
      publish: jest.fn(),
    } as any;

    useCase = new AddItemToShoppingSessionUseCase(
      commerceRepo,
      salesFacade,
      eventBus,
    );
  });

  it('should recalculate percentage discount when a new item is added', async () => {
    const sessionWithCoupon = {
      id: sessionId,
      tenantId,
      branchId: null,
      conversationId: 'conv-1',
      contactId: 'contact-1',
      status: 'BUILDING_CART' as const,
      fulfillmentType: 'PICKUP' as const,
      deliveryAddress: null,
      subtotalAmount: 100,
      freightAmount: 0,
      couponCode: 'PCT10',
      discountAmount: 10,
      totalAmount: 90,
      items: [
        {
          id: 'item-1',
          sessionId,
          tenantId,
          source: 'CATALOG' as const,
          inventoryItemId: null,
          catalogItemId: 'cat-1',
          name: 'Existing Item',
          quantity: 1,
          unitPrice: 100,
          lineTotal: 100,
          currency: 'BRL',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };

    commerceRepo.findSessionById.mockResolvedValueOnce(
      sessionWithCoupon as any,
    );

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
      source: 'CATALOG',
      inventoryItemId: null,
      catalogItemId: 'item-2',
    } as any);

    const refreshedSession = {
      ...sessionWithCoupon,
      items: [
        ...sessionWithCoupon.items,
        {
          id: 'item-2',
          sessionId,
          tenantId,
          source: 'CATALOG' as const,
          inventoryItemId: null,
          catalogItemId: 'item-2',
          name: 'New Item',
          quantity: 1,
          unitPrice: 50,
          lineTotal: 50,
          currency: 'BRL',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };
    commerceRepo.findSessionById.mockResolvedValueOnce(refreshedSession as any);

    salesFacade.findCouponByCode.mockResolvedValue({
      id: 'coupon-1',
      tenantId,
      code: 'PCT10',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      maxUses: null,
      currentUses: 0,
      active: true,
    });

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
    expect(commerceRepo.updateSessionState).toHaveBeenCalledWith(
      expect.objectContaining({
        subtotalAmount: 150,
        discountAmount: 15,
        totalAmount: 135,
      }),
    );
  });
});
