import { Money } from '../domain/value-objects/Money';

describe('Money', () => {
  describe('create', () => {
    it('should create a Money instance with rounded amount', () => {
      const money = Money.create(10.555);
      expect(money.amount).toBe(10.56);
      expect(money.currency).toBe('BRL');
    });

    it('should default currency to BRL', () => {
      const money = Money.create(100);
      expect(money.currency).toBe('BRL');
    });

    it('should accept custom currency', () => {
      const money = Money.create(50, 'USD');
      expect(money.currency).toBe('USD');
    });

    it('should throw on non-finite amount', () => {
      expect(() => Money.create(Infinity)).toThrow('finite number');
      expect(() => Money.create(NaN)).toThrow('finite number');
    });
  });

  describe('zero', () => {
    it('should create a zero Money', () => {
      const money = Money.zero();
      expect(money.amount).toBe(0);
      expect(money.isZero()).toBe(true);
    });
  });

  describe('add', () => {
    it('should add two Money values', () => {
      const a = Money.create(10.5);
      const b = Money.create(5.25);
      const result = a.add(b);
      expect(result.amount).toBe(15.75);
    });

    it('should throw on different currencies', () => {
      const brl = Money.create(10, 'BRL');
      const usd = Money.create(5, 'USD');
      expect(() => brl.add(usd)).toThrow('different currencies');
    });
  });

  describe('subtract', () => {
    it('should subtract two Money values', () => {
      const a = Money.create(20);
      const b = Money.create(7.5);
      const result = a.subtract(b);
      expect(result.amount).toBe(12.5);
    });

    it('should allow negative results', () => {
      const a = Money.create(5);
      const b = Money.create(10);
      const result = a.subtract(b);
      expect(result.amount).toBe(-5);
      expect(result.isNegative()).toBe(true);
    });
  });

  describe('multiply', () => {
    it('should multiply by a factor', () => {
      const money = Money.create(15);
      const result = money.multiply(3);
      expect(result.amount).toBe(45);
    });

    it('should round the result to 2 decimal places', () => {
      const money = Money.create(10);
      const result = money.multiply(0.333);
      expect(result.amount).toBe(3.33);
    });

    it('should throw on non-finite factor', () => {
      const money = Money.create(10);
      expect(() => money.multiply(Infinity)).toThrow('finite number');
    });
  });

  describe('equality', () => {
    it('should be equal for same amount and currency', () => {
      const a = Money.create(10, 'BRL');
      const b = Money.create(10, 'BRL');
      expect(a.equals(b)).toBe(true);
    });

    it('should not be equal for different amounts', () => {
      const a = Money.create(10, 'BRL');
      const b = Money.create(20, 'BRL');
      expect(a.equals(b)).toBe(false);
    });

    it('should not be equal for different currencies', () => {
      const a = Money.create(10, 'BRL');
      const b = Money.create(10, 'USD');
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('predicates', () => {
    it('isPositive returns true for positive amounts', () => {
      expect(Money.create(1).isPositive()).toBe(true);
    });

    it('isPositive returns false for zero', () => {
      expect(Money.zero().isPositive()).toBe(false);
    });

    it('isNegative returns true for negative amounts', () => {
      expect(Money.create(-1).isNegative()).toBe(true);
    });
  });
});
