import { GetShoppingSessionUseCase } from '../application/use-cases/GetShoppingSessionUseCase';
import { ICommerceRepository } from '../domain/ports/ICommerceRepository';
import { NotFoundException } from '@nestjs/common';

describe('GetShoppingSessionUseCase', () => {
  let useCase: GetShoppingSessionUseCase;
  let commerceRepo: jest.Mocked<ICommerceRepository>;

  const tenantId = 'tenant-1';
  const sessionId = 'session-1';

  const mockSession = {
    id: sessionId,
    tenantId,
    branchId: null,
    conversationId: 'conv-1',
    contactId: 'contact-1',
    status: 'BUILDING_CART' as const,
    currentStep: 'IDENTIFYING_NEED' as const,
    fulfillmentType: null,
    shippingMode: null,
    distanceKm: null,
    freightAmount: null,
    subtotalAmount: 150,
    totalAmount: 150,
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
      {
        id: 'item-1',
        sessionId,
        tenantId,
        source: 'CATALOG' as const,
        inventoryItemId: null,
        catalogItemId: 'cat-1',
        name: 'Product A',
        quantity: 2,
        unitPrice: 50,
        lineTotal: 100,
        currency: 'BRL',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'item-2',
        sessionId,
        tenantId,
        source: 'CATALOG' as const,
        inventoryItemId: null,
        catalogItemId: 'cat-2',
        name: 'Product B',
        quantity: 1,
        unitPrice: 50,
        lineTotal: 50,
        currency: 'BRL',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    couponCode: null,
    discountAmount: null,
  };

  beforeEach(() => {
    commerceRepo = {
      findSessionById: jest.fn(),
    } as any;

    useCase = new GetShoppingSessionUseCase(commerceRepo);
  });

  it('should return session by id', async () => {
    commerceRepo.findSessionById.mockResolvedValue(mockSession as any);

    const result = await useCase.execute(tenantId, sessionId);

    expect(result).toEqual(mockSession);
    expect(commerceRepo.findSessionById).toHaveBeenCalledWith(
      tenantId,
      sessionId,
    );
  });

  it('should throw NotFoundException when session is not found', async () => {
    commerceRepo.findSessionById.mockResolvedValue(null);

    await expect(useCase.execute(tenantId, 'non-existent')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should ensure tenant isolation by passing tenantId to repository', async () => {
    const otherTenantId = 'tenant-2';
    commerceRepo.findSessionById.mockResolvedValue(null);

    await expect(useCase.execute(otherTenantId, sessionId)).rejects.toThrow(
      NotFoundException,
    );
    expect(commerceRepo.findSessionById).toHaveBeenCalledWith(
      otherTenantId,
      sessionId,
    );
  });

  it('should return session including items and totals', async () => {
    commerceRepo.findSessionById.mockResolvedValue(mockSession as any);

    const result = await useCase.execute(tenantId, sessionId);

    expect(result.items).toHaveLength(2);
    expect(result.subtotalAmount).toBe(150);
    expect(result.totalAmount).toBe(150);
  });
});
