import { SessionItem } from '../domain/entities/SessionItem';

describe('SessionItem', () => {
  const baseInput = {
    sessionId: 'session-1',
    tenantId: 'tenant-1',
    source: 'CATALOG' as const,
    catalogItemId: 'cat-1',
    inventoryItemId: null,
    name: 'Produto Teste',
    quantity: 3,
    unitPrice: 25.5,
    currency: 'BRL',
  };

  describe('create', () => {
    it('should compute lineTotal as unitPrice * quantity', () => {
      const item = SessionItem.create(baseInput);
      expect(item.lineTotal.amount).toBe(76.5);
    });

    it('should preserve all input properties', () => {
      const item = SessionItem.create(baseInput);
      expect(item.sessionId).toBe('session-1');
      expect(item.tenantId).toBe('tenant-1');
      expect(item.source).toBe('CATALOG');
      expect(item.catalogItemId).toBe('cat-1');
      expect(item.inventoryItemId).toBeNull();
      expect(item.name).toBe('Produto Teste');
      expect(item.quantity).toBe(3);
      expect(item.unitPrice.amount).toBe(25.5);
      expect(item.currency).toBe('BRL');
    });

    it('should generate an id if not provided', () => {
      const item = SessionItem.create(baseInput);
      expect(item.id).toBeDefined();
      expect(item.id.toString()).toBeTruthy();
    });

    it('should use provided id', () => {
      const item = SessionItem.create({ ...baseInput, id: 'item-123' });
      expect(item.id.toString()).toBe('item-123');
    });

    it('should default currency to BRL', () => {
      const { currency, ...inputWithoutCurrency } = baseInput;
      const item = SessionItem.create(inputWithoutCurrency);
      expect(item.currency).toBe('BRL');
    });

    it('should throw on zero quantity', () => {
      expect(() => SessionItem.create({ ...baseInput, quantity: 0 })).toThrow(
        'positive integer',
      );
    });

    it('should throw on negative quantity', () => {
      expect(() => SessionItem.create({ ...baseInput, quantity: -1 })).toThrow(
        'positive integer',
      );
    });

    it('should throw on non-integer quantity', () => {
      expect(() => SessionItem.create({ ...baseInput, quantity: 2.5 })).toThrow(
        'positive integer',
      );
    });

    it('should round lineTotal to 2 decimal places', () => {
      const item = SessionItem.create({ ...baseInput, unitPrice: 10.33, quantity: 3 });
      expect(item.lineTotal.amount).toBe(30.99);
    });
  });
});
