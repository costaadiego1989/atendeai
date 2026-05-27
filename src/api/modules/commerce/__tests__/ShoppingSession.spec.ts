import { ShoppingSession } from '../domain/entities/ShoppingSession';
import { InvalidSessionStateError } from '../domain/errors/InvalidSessionStateError';

describe('ShoppingSession', () => {
  const baseSessionInput = {
    id: 'session-1',
    tenantId: 'tenant-1',
    branchId: null,
    conversationId: 'conv-1',
    contactId: 'contact-1',
    status: 'BUILDING_CART' as const,
    fulfillmentType: 'DELIVERY' as const,
    deliveryAddress: 'Rua Teste, 123',
    couponCode: null,
    subtotalAmount: 0,
    freightAmount: 5,
    discountAmount: 0,
    totalAmount: 5,
    currency: 'BRL',
    items: [
      {
        id: 'item-1',
        sessionId: 'session-1',
        tenantId: 'tenant-1',
        source: 'CATALOG' as const,
        catalogItemId: 'cat-1',
        inventoryItemId: null,
        name: 'Produto A',
        quantity: 2,
        unitPrice: 30,
        lineTotal: 60,
        currency: 'BRL',
      },
      {
        id: 'item-2',
        sessionId: 'session-1',
        tenantId: 'tenant-1',
        source: 'INVENTORY' as const,
        catalogItemId: null,
        inventoryItemId: 'inv-1',
        name: 'Produto B',
        quantity: 1,
        unitPrice: 50,
        lineTotal: 50,
        currency: 'BRL',
      },
    ],
  };

  describe('reconstruct', () => {
    it('should reconstruct a session with items', () => {
      const session = ShoppingSession.reconstruct(baseSessionInput);
      expect(session.id.toString()).toBe('session-1');
      expect(session.tenantId).toBe('tenant-1');
      expect(session.items).toHaveLength(2);
    });

    it('should reconstruct items with computed lineTotals', () => {
      const session = ShoppingSession.reconstruct(baseSessionInput);
      expect(session.items[0].lineTotal.amount).toBe(60);
      expect(session.items[1].lineTotal.amount).toBe(50);
    });
  });

  describe('computeCheckoutTotals', () => {
    it('should compute subtotal from item lineTotals', () => {
      const session = ShoppingSession.reconstruct(baseSessionInput);
      const { subtotal } = session.computeCheckoutTotals();
      expect(subtotal.amount).toBe(110);
    });

    it('should compute total as subtotal + freight - discount', () => {
      const session = ShoppingSession.reconstruct({
        ...baseSessionInput,
        freightAmount: 10,
        discountAmount: 5,
      });
      const { total } = session.computeCheckoutTotals();
      expect(total.amount).toBe(115);
    });

    it('should return zero subtotal for empty items', () => {
      const session = ShoppingSession.reconstruct({
        ...baseSessionInput,
        items: [],
        freightAmount: 0,
        discountAmount: 0,
      });
      const { subtotal, total } = session.computeCheckoutTotals();
      expect(subtotal.amount).toBe(0);
      expect(total.amount).toBe(0);
    });
  });

  describe('recalculateTotals', () => {
    it('should recalculate subtotal and total from items', () => {
      const session = ShoppingSession.reconstruct({
        ...baseSessionInput,
        subtotalAmount: 0,
        totalAmount: 0,
        freightAmount: 8,
        discountAmount: 0,
      });
      session.recalculateTotals();
      expect(session.subtotalAmount.amount).toBe(110);
      expect(session.totalAmount.amount).toBe(118);
    });

    it('should apply discount override', () => {
      const { Money } = require('../domain/value-objects/Money');
      const session = ShoppingSession.reconstruct({
        ...baseSessionInput,
        freightAmount: 0,
        discountAmount: 0,
      });
      session.recalculateTotals(Money.create(20, 'BRL'));
      expect(session.discountAmount.amount).toBe(20);
      expect(session.totalAmount.amount).toBe(90);
    });
  });

  describe('addItem', () => {
    it('should add an item and recalculate totals', () => {
      const session = ShoppingSession.reconstruct({
        ...baseSessionInput,
        freightAmount: 0,
        discountAmount: 0,
        subtotalAmount: 110,
        totalAmount: 110,
      });

      const newItem = session.addItem({
        source: 'CATALOG',
        catalogItemId: 'cat-2',
        name: 'Produto C',
        quantity: 1,
        unitPrice: 25,
        currency: 'BRL',
      });

      expect(newItem.lineTotal.amount).toBe(25);
      expect(session.items).toHaveLength(3);
      expect(session.subtotalAmount.amount).toBe(135);
      expect(session.totalAmount.amount).toBe(135);
    });
  });

  describe('state transitions', () => {
    it('canTransitionTo returns true for valid transitions', () => {
      const session = ShoppingSession.reconstruct(baseSessionInput);
      expect(session.canTransitionTo('READY_FOR_CHECKOUT')).toBe(true);
    });

    it('canTransitionTo returns false for invalid transitions', () => {
      const session = ShoppingSession.reconstruct(baseSessionInput);
      expect(session.canTransitionTo('PAID')).toBe(false);
    });

    it('transitionTo changes the status', () => {
      const session = ShoppingSession.reconstruct(baseSessionInput);
      session.transitionTo('READY_FOR_CHECKOUT');
      expect(session.status).toBe('READY_FOR_CHECKOUT');
    });

    it('transitionTo throws on invalid transition', () => {
      const session = ShoppingSession.reconstruct({
        ...baseSessionInput,
        status: 'PAID',
      });
      expect(() => session.transitionTo('BUILDING_CART')).toThrow(
        InvalidSessionStateError,
      );
    });
  });

  describe('assertCanCheckout', () => {
    it('should not throw for a valid session ready for checkout', () => {
      const session = ShoppingSession.reconstruct({
        ...baseSessionInput,
        status: 'READY_FOR_CHECKOUT',
      });
      expect(() => session.assertCanCheckout()).not.toThrow();
    });

    it('should throw if session is PAID', () => {
      const session = ShoppingSession.reconstruct({
        ...baseSessionInput,
        status: 'PAID',
      });
      expect(() => session.assertCanCheckout()).toThrow();
    });

    it('should throw if no items', () => {
      const session = ShoppingSession.reconstruct({
        ...baseSessionInput,
        status: 'READY_FOR_CHECKOUT',
        items: [],
      });
      expect(() => session.assertCanCheckout()).toThrow('at least one item');
    });

    it('should throw if no fulfillmentType', () => {
      const session = ShoppingSession.reconstruct({
        ...baseSessionInput,
        status: 'READY_FOR_CHECKOUT',
        fulfillmentType: null,
      });
      expect(() => session.assertCanCheckout()).toThrow('pickup or delivery');
    });

    it('should throw if DELIVERY without address', () => {
      const session = ShoppingSession.reconstruct({
        ...baseSessionInput,
        status: 'READY_FOR_CHECKOUT',
        deliveryAddress: '',
      });
      expect(() => session.assertCanCheckout()).toThrow('Delivery address');
    });
  });

  describe('computeLineTotal (static)', () => {
    it('should compute lineTotal from unitPrice and quantity', () => {
      const result = ShoppingSession.computeLineTotal(15.5, 4);
      expect(result.amount).toBe(62);
    });

    it('should use provided currency', () => {
      const result = ShoppingSession.computeLineTotal(10, 2, 'USD');
      expect(result.currency).toBe('USD');
    });
  });
});
