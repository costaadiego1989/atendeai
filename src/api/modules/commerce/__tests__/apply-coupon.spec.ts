import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ApplyCouponToShoppingSessionUseCase,
} from '../application/use-cases/ApplyCouponToShoppingSessionUseCase';
import {
  COMMERCE_REPOSITORY,
  ICommerceRepository,
} from '../domain/ports/ICommerceRepository';
import {
  SALES_FACADE,
  ISalesFacade,
  CouponRecord,
} from '@modules/sales/application/facades/ISalesFacade';
import { CouponMaxUsesReachedException } from '@modules/commerce/domain/errors/CouponMaxUsesReachedException';

const TENANT_ID = 'tenant-1';
const SESSION_ID = 'session-1';
const COUPON_ID = 'coupon-1';
const COUPON_CODE = 'PROMO10';

/** Builds a minimal valid coupon record, overridable per test. */
function makeCoupon(overrides: Partial<CouponRecord> = {}): CouponRecord {
  return {
    id: COUPON_ID,
    tenantId: TENANT_ID,
    code: COUPON_CODE,
    discountType: 'PERCENTAGE',
    discountValue: 10,
    maxUses: 0,          // 0 = unlimited by default
    currentUses: 0,
    active: true,
    startsAt: new Date('2000-01-01'),
    expiresAt: null,
    minimumOrder: null,
    ...overrides,
  };
}

/** Builds a minimal session object. */
function makeSession(subtotalAmount = 100, freightAmount = 0) {
  return { id: SESSION_ID, subtotalAmount, freightAmount } as any;
}

describe('ApplyCouponToShoppingSessionUseCase (ISalesFacade)', () => {
  let useCase: ApplyCouponToShoppingSessionUseCase;
  let commerceRepo: jest.Mocked<ICommerceRepository>;
  let salesFacade: jest.Mocked<ISalesFacade>;

  beforeEach(async () => {
    commerceRepo = {
      findSessionById: jest.fn(),
      updateSessionState: jest.fn(),
    } as any;

    salesFacade = {
      findCouponByCode: jest.fn(),
      incrementCouponUsage: jest.fn(),
      atomicIncrementCouponUsage: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplyCouponToShoppingSessionUseCase,
        { provide: COMMERCE_REPOSITORY, useValue: commerceRepo },
        { provide: SALES_FACADE, useValue: salesFacade },
      ],
    }).compile();

    useCase = module.get(ApplyCouponToShoppingSessionUseCase);
  });

  // ─── session not found ───────────────────────────────────────────────────────
  it('throws NotFoundException when session does not exist', async () => {
    commerceRepo.findSessionById.mockResolvedValue(null);

    await expect(
      useCase.execute({ tenantId: TENANT_ID, sessionId: SESSION_ID, code: COUPON_CODE }),
    ).rejects.toThrow(NotFoundException);
  });

  // ─── coupon not found ────────────────────────────────────────────────────────
  it('throws NotFoundException when coupon code does not exist', async () => {
    commerceRepo.findSessionById.mockResolvedValue(makeSession());
    salesFacade.findCouponByCode.mockResolvedValue(null);

    await expect(
      useCase.execute({ tenantId: TENANT_ID, sessionId: SESSION_ID, code: 'NOPE' }),
    ).rejects.toThrow(NotFoundException);
  });

  // ─── inactive coupon ─────────────────────────────────────────────────────────
  it('throws BadRequestException when coupon is inactive', async () => {
    commerceRepo.findSessionById.mockResolvedValue(makeSession());
    salesFacade.findCouponByCode.mockResolvedValue(makeCoupon({ active: false }));

    await expect(
      useCase.execute({ tenantId: TENANT_ID, sessionId: SESSION_ID, code: COUPON_CODE }),
    ).rejects.toThrow(BadRequestException);
  });

  // ─── not started yet ─────────────────────────────────────────────────────────
  it('throws BadRequestException when coupon has not started yet', async () => {
    const future = new Date();
    future.setDate(future.getDate() + 1);

    commerceRepo.findSessionById.mockResolvedValue(makeSession());
    salesFacade.findCouponByCode.mockResolvedValue(makeCoupon({ startsAt: future }));

    await expect(
      useCase.execute({ tenantId: TENANT_ID, sessionId: SESSION_ID, code: COUPON_CODE }),
    ).rejects.toThrow(BadRequestException);
  });

  // ─── expired coupon ──────────────────────────────────────────────────────────
  it('throws BadRequestException when coupon is expired', async () => {
    const past = new Date();
    past.setDate(past.getDate() - 1);

    commerceRepo.findSessionById.mockResolvedValue(makeSession());
    salesFacade.findCouponByCode.mockResolvedValue(
      makeCoupon({ expiresAt: past }),
    );

    await expect(
      useCase.execute({ tenantId: TENANT_ID, sessionId: SESSION_ID, code: COUPON_CODE }),
    ).rejects.toThrow(BadRequestException);
  });

  // ─── pre-check: maxUses reached ──────────────────────────────────────────────
  it('throws BadRequestException (pre-check) when maxUses > 0 and currentUses >= maxUses', async () => {
    commerceRepo.findSessionById.mockResolvedValue(makeSession());
    salesFacade.findCouponByCode.mockResolvedValue(
      makeCoupon({ maxUses: 5, currentUses: 5 }),
    );

    await expect(
      useCase.execute({ tenantId: TENANT_ID, sessionId: SESSION_ID, code: COUPON_CODE }),
    ).rejects.toThrow(BadRequestException);

    // Should fail before reaching atomicIncrement
    expect(salesFacade.atomicIncrementCouponUsage).not.toHaveBeenCalled();
  });

  // ─── minimumOrder not met ────────────────────────────────────────────────────
  it('throws BadRequestException when session subtotal is below minimumOrder', async () => {
    commerceRepo.findSessionById.mockResolvedValue(makeSession(50)); // subtotal = 50
    salesFacade.findCouponByCode.mockResolvedValue(
      makeCoupon({ minimumOrder: 100 }),
    );

    await expect(
      useCase.execute({ tenantId: TENANT_ID, sessionId: SESSION_ID, code: COUPON_CODE }),
    ).rejects.toThrow(BadRequestException);
  });

  // ─── atomic increment race lost ──────────────────────────────────────────────
  it('throws CouponMaxUsesReachedException when atomicIncrementCouponUsage returns null (race lost)', async () => {
    commerceRepo.findSessionById.mockResolvedValue(makeSession(100));
    salesFacade.findCouponByCode.mockResolvedValue(
      makeCoupon({ maxUses: 10, currentUses: 9 }), // not exhausted at pre-check
    );
    salesFacade.atomicIncrementCouponUsage.mockResolvedValue(null); // race lost

    await expect(
      useCase.execute({ tenantId: TENANT_ID, sessionId: SESSION_ID, code: COUPON_CODE }),
    ).rejects.toThrow(CouponMaxUsesReachedException);
  });

  // ─── happy path: PERCENTAGE discount ─────────────────────────────────────────
  it('happy path PERCENTAGE: calls updateSessionState with correct discountAmount and totalAmount', async () => {
    // subtotal=200, freight=10 → gross=210, 10% discount=20, total=190
    const session = makeSession(200, 10);
    commerceRepo.findSessionById.mockResolvedValue(session);
    salesFacade.findCouponByCode.mockResolvedValue(
      makeCoupon({
        discountType: 'PERCENTAGE',
        discountValue: 10,
        maxUses: 5,
        currentUses: 2,
      }),
    );
    salesFacade.atomicIncrementCouponUsage.mockResolvedValue(makeCoupon() as any);
    commerceRepo.updateSessionState.mockResolvedValue(undefined as any);

    await useCase.execute({ tenantId: TENANT_ID, sessionId: SESSION_ID, code: COUPON_CODE });

    expect(salesFacade.atomicIncrementCouponUsage).toHaveBeenCalledWith(
      TENANT_ID,
      COUPON_ID,
    );
    expect(commerceRepo.updateSessionState).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      sessionId: SESSION_ID,
      couponCode: COUPON_CODE,
      discountAmount: 20,   // 200 * 10 / 100
      totalAmount: 190,     // 210 - 20
    });
  });

  // ─── happy path: FIXED_AMOUNT discount ───────────────────────────────────────
  it('happy path FIXED_AMOUNT: correct math with fixed discount', async () => {
    // subtotal=150, freight=0 → gross=150, fixed=30, total=120
    const session = makeSession(150, 0);
    commerceRepo.findSessionById.mockResolvedValue(session);
    salesFacade.findCouponByCode.mockResolvedValue(
      makeCoupon({
        discountType: 'FIXED_AMOUNT',
        discountValue: 30,
        maxUses: 100,
        currentUses: 5,
      }),
    );
    salesFacade.atomicIncrementCouponUsage.mockResolvedValue(makeCoupon() as any);
    commerceRepo.updateSessionState.mockResolvedValue(undefined as any);

    await useCase.execute({ tenantId: TENANT_ID, sessionId: SESSION_ID, code: COUPON_CODE });

    expect(commerceRepo.updateSessionState).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      sessionId: SESSION_ID,
      couponCode: COUPON_CODE,
      discountAmount: 30,
      totalAmount: 120,
    });
  });

  // ─── maxUses = 0 (unlimited) — no atomic increment ───────────────────────────
  it('does NOT call atomicIncrementCouponUsage when maxUses is 0 (unlimited)', async () => {
    commerceRepo.findSessionById.mockResolvedValue(makeSession(100));
    salesFacade.findCouponByCode.mockResolvedValue(
      makeCoupon({ maxUses: 0, discountType: 'FIXED_AMOUNT', discountValue: 5 }),
    );
    commerceRepo.updateSessionState.mockResolvedValue(undefined as any);

    await useCase.execute({ tenantId: TENANT_ID, sessionId: SESSION_ID, code: COUPON_CODE });

    expect(salesFacade.atomicIncrementCouponUsage).not.toHaveBeenCalled();
    expect(commerceRepo.updateSessionState).toHaveBeenCalled();
  });
});
