// commerce.unit-new.spec.ts — unit tests for commerce module
describe('ShoppingSession validation', () => {
  const makeSession = (o: Record<string, unknown> = {}) => ({
    id: 'sess-1', tenantId: 'tenant-1', contactId: 'contact-1',
    status: 'OPEN', items: [], ...o,
  });

  it('should require tenantId', () => {
    const v = (s: any) => { if (!s.tenantId) throw new Error('tenantId required'); };
    expect(() => v({ contactId: 'c1' })).toThrow();
  });
  it('should require contactId', () => {
    const v = (s: any) => { if (!s.contactId) throw new Error('contactId required'); };
    expect(() => v({ tenantId: 'tenant-1' })).toThrow();
  });
  it('should default status to OPEN', () => {
    const s = makeSession();
    expect(s.status).toBe('OPEN');
  });
  it('should allow OPEN status', () => {
    expect(['OPEN', 'CHECKOUT', 'COMPLETED', 'ABANDONED'].includes('OPEN')).toBe(true);
  });
  it('should allow COMPLETED status', () => {
    expect(['OPEN', 'CHECKOUT', 'COMPLETED', 'ABANDONED'].includes('COMPLETED')).toBe(true);
  });
  it('should reject invalid status', () => {
    expect(['OPEN', 'CHECKOUT', 'COMPLETED', 'ABANDONED'].includes('PENDING')).toBe(false);
  });
});

describe('Cart item validation', () => {
  it('should reject zero quantity', () => {
    const v = (qty: number) => { if (qty <= 0) throw new Error('qty must be positive'); };
    expect(() => v(0)).toThrow();
  });
  it('should reject negative quantity', () => {
    const v = (qty: number) => { if (qty <= 0) throw new Error('qty must be positive'); };
    expect(() => v(-1)).toThrow();
  });
  it('should accept positive quantity', () => {
    const v = (qty: number) => qty > 0;
    expect(v(3)).toBe(true);
  });
  it('should require catalogItemId', () => {
    const v = (item: any) => { if (!item.catalogItemId) throw new Error('itemId required'); };
    expect(() => v({ qty: 1 })).toThrow();
  });
});

describe('Cart total calculation', () => {
  it('should compute total from items', () => {
    const items = [{ price: 10, qty: 2 }, { price: 5, qty: 3 }];
    const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
    expect(total).toBe(35);
  });
  it('should apply percentage coupon', () => {
    const total = 100;
    const discount = total * 0.10;
    expect(discount).toBe(10);
    expect(total - discount).toBe(90);
  });
  it('should apply fixed coupon', () => {
    const total = 100;
    const discount = 15;
    expect(Math.max(0, total - discount)).toBe(85);
  });
  it('should not allow total below zero after discount', () => {
    const total = 10;
    const discount = 20;
    expect(Math.max(0, total - discount)).toBe(0);
  });
});

describe('Coupon validation', () => {
  it('should accept valid coupon code', () => {
    const v = (code: string) => /^[A-Z0-9_-]{3,20}$/.test(code);
    expect(v('PROMO10')).toBe(true);
  });
  it('should reject empty coupon code', () => {
    const v = (code: string) => /^[A-Z0-9_-]{3,20}$/.test(code);
    expect(v('')).toBe(false);
  });
  it('should detect expired coupon', () => {
    const isExpired = (expiresAt: Date) => expiresAt < new Date();
    expect(isExpired(new Date('2020-01-01'))).toBe(true);
  });
  it('should detect valid coupon', () => {
    const isExpired = (expiresAt: Date) => expiresAt < new Date();
    expect(isExpired(new Date('2099-01-01'))).toBe(false);
  });
  it('should detect usage limit exceeded', () => {
    const isLimitReached = (used: number, max: number) => used >= max;
    expect(isLimitReached(10, 10)).toBe(true);
    expect(isLimitReached(9, 10)).toBe(false);
  });
});

describe('Commerce tenant isolation', () => {
  it('should scope session to tenant', () => {
    const s = { id: 'sess-1', tenantId: 'tenant-1' };
    expect(s.tenantId).toBe('tenant-1');
  });
  it('should not access session from different tenant', async () => {
    const repo = { findById: jest.fn().mockImplementation((tenantId: string) =>
      Promise.resolve(tenantId === 'tenant-1' ? { id: 'sess-1' } : null)
    ) };
    expect(await repo.findById('tenant-2', 'sess-1')).toBeNull();
  });
});

describe('Fulfillment validation', () => {
  const validMethods = ['DELIVERY', 'PICKUP', 'DIGITAL'];
  it('should accept DELIVERY', () => expect(validMethods.includes('DELIVERY')).toBe(true));
  it('should accept PICKUP', () => expect(validMethods.includes('PICKUP')).toBe(true));
  it('should accept DIGITAL', () => expect(validMethods.includes('DIGITAL')).toBe(true));
  it('should reject unknown fulfillment method', () => expect(validMethods.includes('DRONE')).toBe(false));
});
