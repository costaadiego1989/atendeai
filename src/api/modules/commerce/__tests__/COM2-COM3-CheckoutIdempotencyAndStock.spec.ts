/**
 * COM2: Oversell — checkout-time stock decrement
 * COM3: Checkout idempotency — atomic CHECKING_OUT transition
 *
 * Tests that CheckoutShoppingSessionUseCase:
 *   - Calls atomicTransitionToCheckingOut before creating order (COM3)
 *   - Throws SessionAlreadyProcessingException when transition returns false (COM3)
 *   - Calls decrementStockForCheckout for all inventory items (COM2)
 *   - Throws InsufficientStockException when any item has insufficient stock (COM2)
 */
import { CheckoutShoppingSessionUseCase } from '../application/use-cases/CheckoutShoppingSessionUseCase';
import { ICommerceRepository } from '../domain/ports/ICommerceRepository';
import { IEventBus } from '@shared/application/ports/IEventBus';
import { SessionAlreadyProcessingException } from '../domain/errors/SessionAlreadyProcessingException';
import { InsufficientStockException } from '../domain/errors/InsufficientStockException';

describe('COM2 + COM3: CheckoutShoppingSessionUseCase — idempotency and stock', () => {
  let useCase: CheckoutShoppingSessionUseCase;
  let commerceRepo: jest.Mocked<ICommerceRepository>;
  let paymentFacade: any;
  let eventBus: jest.Mocked<IEventBus>;

  const tenantId = 'tenant-1';
  const sessionId = 'session-1';

  const inventoryItemId = 'inv-item-1';

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
    carrierCep: null,
    carrierServiceName: null,
    distanceKm: null,
    freightAmount: 0,
    subtotalAmount: 100,
    discountAmount: 0,
    totalAmount: 100,
    deliveryAddress: null,
    couponCode: null,
    items: [
      {
        id: 'si-1',
        sessionId,
        tenantId,
        source: 'INVENTORY' as const,
        inventoryItemId,
        catalogItemId: null,
        name: 'Widget',
        quantity: 2,
        unitPrice: 50,
        lineTotal: 100,
        currency: 'BRL',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  };

  const mockPaymentLink = { id: 'link-1', url: 'https://pay.example.com/link-1' };

  beforeEach(() => {
    commerceRepo = {
      findSessionById: jest.fn().mockResolvedValue(mockSession),
      atomicTransitionToCheckingOut: jest.fn().mockResolvedValue(true),
      decrementStockForCheckout: jest.fn().mockResolvedValue(undefined),
      createOrder: jest.fn().mockResolvedValue({ ...mockSession, id: 'order-1' }),
      updateOrderPaymentLink: jest.fn().mockResolvedValue({ id: 'order-1', paymentLinkId: 'link-1', paymentLinkUrl: mockPaymentLink.url }),
      updateOrderStatus: jest.fn().mockResolvedValue(undefined),
      updateSessionState: jest.fn().mockResolvedValue({ ...mockSession, status: 'AWAITING_PAYMENT' }),
      saveAuditLog: jest.fn().mockResolvedValue(undefined),
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

  // COM3: Idempotency
  describe('COM3: checkout idempotency', () => {
    it('should call atomicTransitionToCheckingOut before creating order', async () => {
      await useCase.execute({ tenantId, sessionId });

      expect(commerceRepo.atomicTransitionToCheckingOut).toHaveBeenCalledWith(
        tenantId,
        sessionId,
      );
      // Must be called before createOrder
      const atomicCallOrder = (commerceRepo.atomicTransitionToCheckingOut as jest.Mock).mock.invocationCallOrder[0];
      const createOrderCallOrder = (commerceRepo.createOrder as jest.Mock).mock.invocationCallOrder[0];
      expect(atomicCallOrder).toBeLessThan(createOrderCallOrder);
    });

    it('should throw SessionAlreadyProcessingException when atomicTransitionToCheckingOut returns false', async () => {
      (commerceRepo.atomicTransitionToCheckingOut as jest.Mock).mockResolvedValue(false);

      await expect(
        useCase.execute({ tenantId, sessionId }),
      ).rejects.toThrow(SessionAlreadyProcessingException);

      // Order must NOT be created
      expect(commerceRepo.createOrder).not.toHaveBeenCalled();
    });

    it('simulates concurrent double-checkout: only one CHECKING_OUT transition succeeds', async () => {
      let transitionCount = 0;
      (commerceRepo.atomicTransitionToCheckingOut as jest.Mock).mockImplementation(() => {
        transitionCount++;
        return Promise.resolve(transitionCount === 1);
      });

      const [r1, r2] = await Promise.allSettled([
        useCase.execute({ tenantId, sessionId }),
        useCase.execute({ tenantId, sessionId }),
      ]);

      const successes = [r1, r2].filter((r) => r.status === 'fulfilled');
      const failures = [r1, r2].filter((r) => r.status === 'rejected');

      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);
      if (failures[0].status === 'rejected') {
        expect(failures[0].reason).toBeInstanceOf(SessionAlreadyProcessingException);
      }
    });
  });

  // COM2: Stock
  describe('COM2: checkout-time stock decrement', () => {
    it('should call decrementStockForCheckout with inventory items', async () => {
      await useCase.execute({ tenantId, sessionId });

      expect(commerceRepo.decrementStockForCheckout).toHaveBeenCalledWith(
        tenantId,
        [{ inventoryItemId, quantity: 2 }],
      );
    });

    it('should throw InsufficientStockException when decrementStockForCheckout throws it', async () => {
      (commerceRepo.decrementStockForCheckout as jest.Mock).mockRejectedValue(
        new InsufficientStockException(inventoryItemId),
      );

      await expect(
        useCase.execute({ tenantId, sessionId }),
      ).rejects.toThrow(InsufficientStockException);

      expect(commerceRepo.createOrder).not.toHaveBeenCalled();
    });

    it('should NOT call decrementStockForCheckout for sessions with only catalog items', async () => {
      const catalogOnlySession = {
        ...mockSession,
        items: [
          {
            id: 'si-2',
            sessionId,
            tenantId,
            source: 'CATALOG' as const,
            inventoryItemId: null,
            catalogItemId: 'cat-1',
            name: 'Digital Item',
            quantity: 1,
            unitPrice: 100,
            lineTotal: 100,
            currency: 'BRL',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };
      (commerceRepo.findSessionById as jest.Mock).mockResolvedValue(catalogOnlySession);

      await useCase.execute({ tenantId, sessionId });

      expect(commerceRepo.decrementStockForCheckout).not.toHaveBeenCalled();
    });
  });
});
