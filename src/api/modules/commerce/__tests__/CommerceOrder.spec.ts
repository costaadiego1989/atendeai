import { CommerceOrder } from '../domain/entities/CommerceOrder';
import { InvalidOrderTransitionError } from '../domain/value-objects/OrderStatus';

describe('CommerceOrder', () => {
  const baseInput = {
    id: 'order-1',
    tenantId: 'tenant-1',
    branchId: null,
    sessionId: 'session-1',
    conversationId: 'conv-1',
    contactId: 'contact-1',
    fulfillmentType: 'DELIVERY' as const,
    shippingMode: 'FIXED',
    subtotalAmount: 100,
    freightAmount: 10,
    discountAmount: 5,
    totalAmount: 105,
    deliveryAddress: 'Rua Teste, 123',
    paymentReference: 'commerce|tenant-1|order-1',
    couponCode: 'PROMO10',
    currency: 'BRL',
  };

  describe('create', () => {
    it('should create an order with AWAITING_PAYMENT status', () => {
      const order = CommerceOrder.create(baseInput);
      expect(order.status).toBe('AWAITING_PAYMENT');
    });

    it('should set Money values correctly', () => {
      const order = CommerceOrder.create(baseInput);
      expect(order.subtotalAmount.amount).toBe(100);
      expect(order.freightAmount.amount).toBe(10);
      expect(order.discountAmount.amount).toBe(5);
      expect(order.totalAmount.amount).toBe(105);
    });

    it('should preserve all input properties', () => {
      const order = CommerceOrder.create(baseInput);
      expect(order.tenantId).toBe('tenant-1');
      expect(order.sessionId).toBe('session-1');
      expect(order.conversationId).toBe('conv-1');
      expect(order.contactId).toBe('contact-1');
      expect(order.fulfillmentType).toBe('DELIVERY');
      expect(order.paymentReference).toBe('commerce|tenant-1|order-1');
    });
  });

  describe('reconstruct', () => {
    it('should reconstruct with given status', () => {
      const order = CommerceOrder.reconstruct({
        ...baseInput,
        status: 'PAID',
        paymentLinkId: 'link-1',
        paymentLinkUrl: 'https://pay.example.com/link-1',
        paymentStatus: 'CONFIRMED',
      });
      expect(order.status).toBe('PAID');
      expect(order.isPaid).toBe(true);
    });
  });

  describe('state transitions', () => {
    it('canTransitionTo returns true for valid transitions', () => {
      const order = CommerceOrder.reconstruct({
        ...baseInput,
        status: 'PAID',
        paymentLinkId: null,
        paymentLinkUrl: null,
        paymentStatus: 'CONFIRMED',
      });
      expect(order.canTransitionTo('PREPARING')).toBe(true);
      expect(order.canTransitionTo('CANCELLED')).toBe(true);
    });

    it('canTransitionTo returns false for invalid transitions', () => {
      const order = CommerceOrder.create(baseInput);
      expect(order.canTransitionTo('PREPARING')).toBe(false);
      expect(order.canTransitionTo('DELIVERED')).toBe(false);
    });

    it('transitionTo changes the status', () => {
      const order = CommerceOrder.reconstruct({
        ...baseInput,
        status: 'PAID',
        paymentLinkId: null,
        paymentLinkUrl: null,
        paymentStatus: 'CONFIRMED',
      });
      order.transitionTo('PREPARING');
      expect(order.status).toBe('PREPARING');
    });

    it('transitionTo throws InvalidOrderTransitionError on invalid transition', () => {
      const order = CommerceOrder.reconstruct({
        ...baseInput,
        status: 'DELIVERED',
        paymentLinkId: null,
        paymentLinkUrl: null,
        paymentStatus: 'CONFIRMED',
      });
      expect(() => order.transitionTo('PAID')).toThrow(InvalidOrderTransitionError);
    });
  });

  describe('assertValidTransition', () => {
    it('should not throw for valid transition', () => {
      const order = CommerceOrder.reconstruct({
        ...baseInput,
        status: 'PREPARING',
        paymentLinkId: null,
        paymentLinkUrl: null,
        paymentStatus: 'CONFIRMED',
      });
      expect(() => order.assertValidTransition('DELIVERED')).not.toThrow();
    });

    it('should throw for invalid transition', () => {
      const order = CommerceOrder.reconstruct({
        ...baseInput,
        status: 'CANCELLED',
        paymentLinkId: null,
        paymentLinkUrl: null,
        paymentStatus: 'CONFIRMED',
      });
      expect(() => order.assertValidTransition('PAID')).toThrow(
        InvalidOrderTransitionError,
      );
    });
  });

  describe('predicates', () => {
    it('isPaid returns true for PAID status', () => {
      const order = CommerceOrder.reconstruct({
        ...baseInput,
        status: 'PAID',
        paymentLinkId: null,
        paymentLinkUrl: null,
        paymentStatus: 'CONFIRMED',
      });
      expect(order.isPaid).toBe(true);
    });

    it('isPaid returns false for non-PAID status', () => {
      const order = CommerceOrder.create(baseInput);
      expect(order.isPaid).toBe(false);
    });

    it('isTerminal returns true for DELIVERED', () => {
      const order = CommerceOrder.reconstruct({
        ...baseInput,
        status: 'DELIVERED',
        paymentLinkId: null,
        paymentLinkUrl: null,
        paymentStatus: 'CONFIRMED',
      });
      expect(order.isTerminal).toBe(true);
    });

    it('isTerminal returns true for CANCELLED', () => {
      const order = CommerceOrder.reconstruct({
        ...baseInput,
        status: 'CANCELLED',
        paymentLinkId: null,
        paymentLinkUrl: null,
        paymentStatus: 'CONFIRMED',
      });
      expect(order.isTerminal).toBe(true);
    });

    it('isTerminal returns false for PREPARING', () => {
      const order = CommerceOrder.reconstruct({
        ...baseInput,
        status: 'PREPARING',
        paymentLinkId: null,
        paymentLinkUrl: null,
        paymentStatus: 'CONFIRMED',
      });
      expect(order.isTerminal).toBe(false);
    });
  });
});
