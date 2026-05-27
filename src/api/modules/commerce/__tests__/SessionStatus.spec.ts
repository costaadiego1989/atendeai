import { SessionStatus } from '../domain/value-objects/SessionStatus';
import { InvalidSessionStateError } from '../domain/errors/InvalidSessionStateError';

describe('SessionStatus', () => {
  describe('create', () => {
    it('should create a SessionStatus with the given value', () => {
      const status = SessionStatus.create('BUILDING_CART');
      expect(status.value).toBe('BUILDING_CART');
    });
  });

  describe('factory methods', () => {
    it('buildingCart creates BUILDING_CART', () => {
      expect(SessionStatus.buildingCart().value).toBe('BUILDING_CART');
    });

    it('awaitingPayment creates AWAITING_PAYMENT', () => {
      expect(SessionStatus.awaitingPayment().value).toBe('AWAITING_PAYMENT');
    });

    it('paid creates PAID', () => {
      expect(SessionStatus.paid().value).toBe('PAID');
    });

    it('cancelled creates CANCELLED', () => {
      expect(SessionStatus.cancelled().value).toBe('CANCELLED');
    });
  });

  describe('isTerminal', () => {
    it('PAID is terminal', () => {
      expect(SessionStatus.paid().isTerminal()).toBe(true);
    });

    it('CANCELLED is terminal', () => {
      expect(SessionStatus.cancelled().isTerminal()).toBe(true);
    });

    it('BUILDING_CART is not terminal', () => {
      expect(SessionStatus.buildingCart().isTerminal()).toBe(false);
    });

    it('AWAITING_PAYMENT is not terminal', () => {
      expect(SessionStatus.awaitingPayment().isTerminal()).toBe(false);
    });
  });

  describe('canTransitionTo', () => {
    it('BUILDING_CART can transition to READY_FOR_CHECKOUT', () => {
      expect(SessionStatus.buildingCart().canTransitionTo('READY_FOR_CHECKOUT')).toBe(true);
    });

    it('BUILDING_CART can transition to CANCELLED', () => {
      expect(SessionStatus.buildingCart().canTransitionTo('CANCELLED')).toBe(true);
    });

    it('BUILDING_CART cannot transition to PAID', () => {
      expect(SessionStatus.buildingCart().canTransitionTo('PAID')).toBe(false);
    });

    it('AWAITING_PAYMENT can transition to PAID', () => {
      expect(SessionStatus.awaitingPayment().canTransitionTo('PAID')).toBe(true);
    });

    it('AWAITING_PAYMENT can transition to CANCELLED', () => {
      expect(SessionStatus.awaitingPayment().canTransitionTo('CANCELLED')).toBe(true);
    });

    it('PAID cannot transition to anything', () => {
      const paid = SessionStatus.paid();
      expect(paid.canTransitionTo('BUILDING_CART')).toBe(false);
      expect(paid.canTransitionTo('CANCELLED')).toBe(false);
    });

    it('CANCELLED cannot transition to anything', () => {
      const cancelled = SessionStatus.cancelled();
      expect(cancelled.canTransitionTo('BUILDING_CART')).toBe(false);
      expect(cancelled.canTransitionTo('PAID')).toBe(false);
    });
  });

  describe('transitionTo', () => {
    it('should return new status on valid transition', () => {
      const status = SessionStatus.buildingCart();
      const next = status.transitionTo('READY_FOR_CHECKOUT', 'session-1');
      expect(next.value).toBe('READY_FOR_CHECKOUT');
    });

    it('should throw InvalidSessionStateError on invalid transition', () => {
      const status = SessionStatus.paid();
      expect(() => status.transitionTo('BUILDING_CART', 'session-1')).toThrow(
        InvalidSessionStateError,
      );
    });
  });
});
