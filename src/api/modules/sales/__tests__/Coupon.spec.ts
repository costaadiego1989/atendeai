import { Coupon } from '../domain/entities/Coupon';

describe('Coupon Entity', () => {
  const tenantId = 'tenant-xyz';

  it('should create an active coupon by default', () => {
    const startsAt = new Date();
    const coupon = Coupon.create({
      tenantId,
      code: 'WELCOME10',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      maxUses: 0,
      startsAt,
    });

    expect(coupon.code).toBe('WELCOME10');
    expect(coupon.active).toBe(true);
    expect(coupon.usedCount).toBe(0);
    expect(coupon.isUnlimited).toBe(true);
    expect(coupon.canRedeem()).toBe(true);
  });

  it('should allow redeem calls up to maxUses when limit is set', () => {
    const coupon = Coupon.create({
      tenantId,
      code: 'LIMIT3',
      discountType: 'FIXED_AMOUNT',
      discountValue: 50,
      maxUses: 3,
      startsAt: new Date(Date.now() - 10000), // started 10s ago
    });

    expect(coupon.isUnlimited).toBe(false);
    expect(coupon.canRedeem()).toBe(true);

    coupon.redeem(); // 1
    expect(coupon.usedCount).toBe(1);
    expect(coupon.canRedeem()).toBe(true);

    coupon.redeem(); // 2
    coupon.redeem(); // 3

    expect(coupon.usedCount).toBe(3);
    expect(coupon.canRedeem()).toBe(false);

    expect(() => coupon.redeem()).toThrow('Coupon cannot be redeemed');
  });

  it('should block redeem when deactivated manually', () => {
    const coupon = Coupon.create({
      tenantId,
      code: 'OFF',
      discountType: 'PERCENTAGE',
      discountValue: 15,
      maxUses: 0,
      startsAt: new Date(Date.now() - 10000),
    });

    expect(coupon.canRedeem()).toBe(true);
    coupon.deactivate();
    expect(coupon.canRedeem()).toBe(false);
  });

  it('should match explicit item and category targets', () => {
    const coupon = Coupon.create({
      tenantId,
      code: 'TARGETS',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      maxUses: 0,
      startsAt: new Date(Date.now() - 10000),
      targets: [
        { targetType: 'ITEM', targetId: 'item-1' },
        { targetType: 'CATEGORY', targetId: 'category-1' },
      ],
    });

    expect(coupon.appliesTo({ targetType: 'ITEM', targetId: 'item-1' })).toBe(
      true,
    );
    expect(
      coupon.appliesTo({ targetType: 'CATEGORY', targetId: 'category-1' }),
    ).toBe(true);
    expect(
      coupon.appliesTo({ targetType: 'CATEGORY', targetId: 'category-2' }),
    ).toBe(false);
  });

  it('should treat legacy catalogItemId as an item target', () => {
    const coupon = Coupon.create({
      tenantId,
      code: 'LEGACY',
      discountType: 'FIXED_AMOUNT',
      discountValue: 5,
      maxUses: 0,
      startsAt: new Date(Date.now() - 10000),
      catalogItemId: 'legacy-item',
    });

    expect(
      coupon.appliesTo({ targetType: 'ITEM', targetId: 'legacy-item' }),
    ).toBe(true);
    expect(
      coupon.appliesTo({ targetType: 'ITEM', targetId: 'other-item' }),
    ).toBe(false);
  });
});
