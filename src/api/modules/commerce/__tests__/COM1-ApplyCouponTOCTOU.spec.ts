/**
 * COM1: Coupon over-use TOCTOU race
 *
 * Tests that ApplyCouponToShoppingSessionUseCase calls atomicIncrementCouponUsage
 * (not the racy read-then-write pattern) and that a null return (coupon exhausted)
 * throws CouponMaxUsesReachedException.
 */
import { ApplyCouponToShoppingSessionUseCase } from '../application/use-cases/ApplyCouponToShoppingSessionUseCase';
import { ICommerceRepository } from '../domain/ports/ICommerceRepository';
import { ISalesCouponRepository } from '@modules/sales/domain/repositories/ISalesRepository';
import { CouponMaxUsesReachedException } from '../domain/errors/CouponMaxUsesReachedException';
import { BadRequestException } from '@nestjs/common';

describe('COM1: ApplyCouponToShoppingSessionUseCase — atomic coupon increment', () => {
  let useCase: ApplyCouponToShoppingSessionUseCase;
  let commerceRepo: jest.Mocked<ICommerceRepository>;
  let salesRepo: jest.Mocked<ISalesCouponRepository>;

  const tenantId = 'tenant-1';
  const sessionId = 'session-1';

  const mockSession = {
    id: sessionId,
    tenantId,
    subtotalAmount: 100,
    freightAmount: 0,
    discountAmount: 0,
    totalAmount: 100,
    couponCode: null,
    items: [],
  };

  const validCoupon = {
    id: 'coupon-1',
    code: 'SAVE10',
    active: true,
    startsAt: new Date(2000, 1, 1),
    expiresAt: null,
    maxUses: 1,
    usedCount: 0,
    discountType: 'FIXED_AMOUNT' as const,
    discountValue: 10,
    minimumOrder: null,
    tenantId,
  };

  beforeEach(() => {
    commerceRepo = {
      findSessionById: jest.fn().mockResolvedValue(mockSession),
      updateSessionState: jest.fn().mockResolvedValue({ ...mockSession, couponCode: 'SAVE10', discountAmount: 10, totalAmount: 90 }),
    } as any;

    salesRepo = {
      findCouponByCode: jest.fn().mockResolvedValue(validCoupon),
      atomicIncrementCouponUsage: jest.fn().mockResolvedValue({ ...validCoupon, usedCount: 1 }),
    } as any;

    useCase = new ApplyCouponToShoppingSessionUseCase(commerceRepo, salesRepo);
  });

  it('should call atomicIncrementCouponUsage instead of the racy read+increment', async () => {
    await useCase.execute({ tenantId, sessionId, code: 'SAVE10' });

    expect(salesRepo.atomicIncrementCouponUsage).toHaveBeenCalledWith(
      tenantId,
      validCoupon.id,
    );
    // The old non-atomic incrementCouponUsage must NOT be called
    expect((salesRepo as any).incrementCouponUsage).toBeUndefined();
  });

  it('should throw CouponMaxUsesReachedException when atomicIncrementCouponUsage returns null (race lost)', async () => {
    (salesRepo.atomicIncrementCouponUsage as jest.Mock).mockResolvedValue(null);

    await expect(
      useCase.execute({ tenantId, sessionId, code: 'SAVE10' }),
    ).rejects.toThrow(CouponMaxUsesReachedException);
  });

  it('should NOT throw on maxUses check when usedCount < maxUses (pre-check still passes)', async () => {
    // Coupon has 1 max use and 0 used — should proceed to atomicIncrementCouponUsage
    await expect(
      useCase.execute({ tenantId, sessionId, code: 'SAVE10' }),
    ).resolves.toBeDefined();
  });

  it('simulates concurrent usage: first request succeeds, second gets null from atomic op', async () => {
    let callCount = 0;
    (salesRepo.atomicIncrementCouponUsage as jest.Mock).mockImplementation(() => {
      callCount++;
      // First call succeeds, second returns null (race lost)
      return callCount === 1
        ? Promise.resolve({ ...validCoupon, usedCount: 1 })
        : Promise.resolve(null);
    });

    const [result1, result2] = await Promise.allSettled([
      useCase.execute({ tenantId, sessionId: 'session-1', code: 'SAVE10' }),
      useCase.execute({ tenantId, sessionId: 'session-1', code: 'SAVE10' }),
    ]);

    expect(result1.status).toBe('fulfilled');
    expect(result2.status).toBe('rejected');
    if (result2.status === 'rejected') {
      expect(result2.reason).toBeInstanceOf(CouponMaxUsesReachedException);
    }
  });
});
