import { OrderStatus, InvalidOrderTransitionError } from '../domain/value-objects/OrderStatus';

describe('OrderStatus', () => {
  describe('create', () => {
    it('should create an OrderStatus with the given value', () => {
      const status = OrderStatus.create('PAID');
      expect(status.value).toBe('PAID');
    });
  });

  describe('factory methods', () => {
    it('awaitingPayment creates AWAITING_PAYMENT', () => {
      expect(OrderStatus.awaitingPayment().value).toBe('AWAITING_PAYMENT');
    });

    it('paid creates PAID', () => {
      expect(OrderStatus.paid().value).toBe('PAID');
    });

    it('cancelled creates CANCELLED', () => {
      expect(OrderStatus.cancelled().value).toBe('CANCELLED');
    });
  });

  describe('isTerminal', () => {
    it('DELIVERED is terminal', () => {
      expect(OrderStatus.create('DELIVERED').isTerminal()).toBe(true);
    });

    it('CANCELLED is terminal', () => {
      expect(OrderStatus.cancelled().isTerminal()).toBe(true);
    });

    it('PAID is not terminal', () => {
      expect(OrderStatus.paid().isTerminal()).toBe(false);
    });

    it('AWAITING_PAYMENT is not terminal', () => {
      expect(OrderStatus.awaitingPayment().isTerminal()).toBe(false);
    });
  });

  describe('isPaid', () => {
    it('returns true for PAID', () => {
      expect(OrderStatus.paid().isPaid()).toBe(true);
    });

    it('returns false for other statuses', () => {
      expect(OrderStatus.awaitingPayment().isPaid()).toBe(false);
      expect(OrderStatus.create('PREPARING').isPaid()).toBe(false);
    });
  });

  describe('canTransitionTo', () => {
    it('AWAITING_PAYMENT can transition to PAID', () => {
      expect(OrderStatus.awaitingPayment().canTransitionTo('PAID')).toBe(true);
    });

    it('AWAITING_PAYMENT can transition to CANCELLED', () => {
      expect(OrderStatus.awaitingPayment().canTransitionTo('CANCELLED')).toBe(true);
    });

    it('AWAITING_PAYMENT cannot transition to PREPARING', () => {
      expect(OrderStatus.awaitingPayment().canTransitionTo('PREPARING')).toBe(false);
    });

    it('PAID can transition to PREPARING', () => {
      expect(OrderStatus.paid().canTransitionTo('PREPARING')).toBe(true);
    });

    it('PAID can transition to CANCELLED', () => {
      expect(OrderStatus.paid().canTransitionTo('CANCELLED')).toBe(true);
    });

    it('PREPARING can transition to READY_FOR_PICKUP', () => {
      expect(OrderStatus.create('PREPARING').canTransitionTo('READY_FOR_PICKUP')).toBe(true);
    });

    it('PREPARING can transition to OUT_FOR_DELIVERY', () => {
      expect(OrderStatus.create('PREPARING').canTransitionTo('OUT_FOR_DELIVERY')).toBe(true);
    });

    it('DELIVERED cannot transition to anything', () => {
      const delivered = OrderStatus.create('DELIVERED');
      expect(delivered.canTransitionTo('CANCELLED')).toBe(false);
      expect(delivered.canTransitionTo('PAID')).toBe(false);
    });

    it('CANCELLED cannot transition to anything', () => {
      const cancelled = OrderStatus.cancelled();
      expect(cancelled.canTransitionTo('PAID')).toBe(false);
      expect(cancelled.canTransitionTo('PREPARING')).toBe(false);
    });
  });

  describe('transitionTo', () => {
    it('should return new status on valid transition', () => {
      const status = OrderStatus.paid();
      const next = status.transitionTo('PREPARING', 'order-1');
      expect(next.value).toBe('PREPARING');
    });

    it('should throw InvalidOrderTransitionError on invalid transition', () => {
      const status = OrderStatus.create('DELIVERED');
      expect(() => status.transitionTo('PAID', 'order-1')).toThrow(
        InvalidOrderTransitionError,
      );
    });

    it('error message includes order id and statuses', () => {
      const status = OrderStatus.awaitingPayment();
      try {
        status.transitionTo('PREPARING', 'order-xyz');
        fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('order-xyz');
        expect((error as Error).message).toContain('AWAITING_PAYMENT');
        expect((error as Error).message).toContain('PREPARING');
      }
    });
  });
});
