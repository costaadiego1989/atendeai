import { Promotion } from '../domain/entities/Promotion';

describe('Promotion Entity', () => {
  const tenantId = 'tenant-123';

  it('should create an active promotion by default', () => {
    const startsAt = new Date();
    const promo = Promotion.create({
      tenantId,
      title: 'Promo P1',
      description: 'Desc',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      startsAt,
    });

    expect(promo.active).toBe(true);
    expect(promo.title).toBe('Promo P1');
    expect(promo.tenantId).toBe(tenantId);
    expect(promo.isCurrentlyActive()).toBe(true);
  });

  it('should identify a future promotion as not active currently', () => {
    const startsAt = new Date(Date.now() + 86400000); // tomorrow
    const promo = Promotion.create({
      tenantId,
      title: 'Future promo',
      description: 'Desc',
      discountType: 'FIXED_AMOUNT',
      discountValue: 10,
      startsAt,
    });

    expect(promo.active).toBe(true);
    // Even if active flag is true, valid time hasn't started
    expect(promo.isCurrentlyActive()).toBe(false);
  });

  it('should identify an expired promotion as not active', () => {
    const startsAt = new Date(Date.now() - 172800000); // 2 days ago
    const expiresAt = new Date(Date.now() - 86400000); // expired yesterday

    const promo = Promotion.create({
      tenantId,
      title: 'Expired promo',
      description: 'Desc',
      discountType: 'PERCENTAGE',
      discountValue: 15,
      startsAt,
      expiresAt,
    });

    expect(promo.active).toBe(true);
    // Outside validity window
    expect(promo.isCurrentlyActive()).toBe(false);
  });

  it('should deactivate a promotion via method', () => {
    const promo = Promotion.create({
      tenantId,
      title: 'Test',
      description: 'Desc',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      startsAt: new Date(Date.now() - 10000), // started 10s ago
    });

    expect(promo.isCurrentlyActive()).toBe(true);

    promo.deactivate();

    expect(promo.active).toBe(false);
    expect(promo.isCurrentlyActive()).toBe(false);
  });

  it('should match explicit item and category targets', () => {
    const promo = Promotion.create({
      tenantId,
      title: 'Targeted promo',
      description: 'Desc',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      startsAt: new Date(Date.now() - 10000),
      targets: [
        { targetType: 'ITEM', targetId: 'item-1' },
        { targetType: 'CATEGORY', targetId: 'category-1' },
      ],
    });

    expect(promo.appliesTo({ targetType: 'ITEM', targetId: 'item-1' })).toBe(true);
    expect(promo.appliesTo({ targetType: 'CATEGORY', targetId: 'category-1' })).toBe(true);
    expect(promo.appliesTo({ targetType: 'ITEM', targetId: 'item-2' })).toBe(false);
  });

  it('should treat legacy catalogItemId as an item target', () => {
    const promo = Promotion.create({
      tenantId,
      title: 'Legacy promo',
      description: 'Desc',
      discountType: 'FIXED_AMOUNT',
      discountValue: 10,
      startsAt: new Date(Date.now() - 10000),
      catalogItemId: 'legacy-item',
    });

    expect(promo.appliesTo({ targetType: 'ITEM', targetId: 'legacy-item' })).toBe(true);
    expect(promo.appliesTo({ targetType: 'ITEM', targetId: 'other-item' })).toBe(false);
  });
});
