import { ApplyCouponToShoppingSessionUseCase } from '../application/use-cases/ApplyCouponToShoppingSessionUseCase';
import { ICommerceRepository } from '../domain/ports/ICommerceRepository';
import { ISalesCouponRepository } from '@modules/sales/domain/repositories/ISalesRepository';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('ApplyCouponToShoppingSessionUseCase', () => {
  let useCase: ApplyCouponToShoppingSessionUseCase;
  let commerceRepo: jest.Mocked<ICommerceRepository>;
  let salesRepo: jest.Mocked<ISalesCouponRepository>;

  const tenantId = 'tenant-1';
  const sessionId = 'session-1';

  beforeEach(() => {
    commerceRepo = {
      findSessionById: jest.fn(),
      updateSessionState: jest.fn(),
    } as any;

    salesRepo = {
      findCouponByCode: jest.fn(),
    } as any;

    useCase = new ApplyCouponToShoppingSessionUseCase(commerceRepo, salesRepo);
  });

  it('should throw NotFoundException if shopping session does not exist', async () => {
    commerceRepo.findSessionById.mockResolvedValue(null);

    await expect(
      useCase.execute({ tenantId, sessionId, code: 'VALID_CODE' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw NotFoundException if coupon code is invalid', async () => {
    commerceRepo.findSessionById.mockResolvedValue({ id: sessionId } as any);
    salesRepo.findCouponByCode.mockResolvedValue(null);

    await expect(
      useCase.execute({ tenantId, sessionId, code: 'INVALID_CODE' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException if coupon is inactive', async () => {
    commerceRepo.findSessionById.mockResolvedValue({ id: sessionId } as any);
    salesRepo.findCouponByCode.mockResolvedValue({
      id: 'coupon-1',
      active: false,
      startsAt: new Date(2000, 1, 1),
      expiresAt: null,
      maxUses: 0,
      usedCount: 0,
    } as any);

    await expect(
      useCase.execute({ tenantId, sessionId, code: 'INACTIVE' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException if coupon has not started yet', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);

    commerceRepo.findSessionById.mockResolvedValue({ id: sessionId } as any);
    salesRepo.findCouponByCode.mockResolvedValue({
      id: 'coupon-1',
      active: true,
      startsAt: futureDate,
      expiresAt: null,
      maxUses: 0,
      usedCount: 0,
    } as any);

    await expect(
      useCase.execute({ tenantId, sessionId, code: 'FUTURE' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException if coupon is expired', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    commerceRepo.findSessionById.mockResolvedValue({ id: sessionId } as any);
    salesRepo.findCouponByCode.mockResolvedValue({
      id: 'coupon-1',
      active: true,
      startsAt: new Date(2000, 1, 1),
      expiresAt: pastDate,
      maxUses: 0,
      usedCount: 0,
    } as any);

    await expect(
      useCase.execute({ tenantId, sessionId, code: 'EXPIRED' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException if coupon usage limit is reached', async () => {
    commerceRepo.findSessionById.mockResolvedValue({ id: sessionId } as any);
    salesRepo.findCouponByCode.mockResolvedValue({
      id: 'coupon-1',
      active: true,
      startsAt: new Date(2000, 1, 1),
      expiresAt: null,
      maxUses: 10,
      usedCount: 10,
    } as any);

    await expect(
      useCase.execute({ tenantId, sessionId, code: 'LIMIT_REACHED' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException if minimum order amount is not met', async () => {
    commerceRepo.findSessionById.mockResolvedValue({
      id: sessionId,
      subtotalAmount: 50,
    } as any);

    salesRepo.findCouponByCode.mockResolvedValue({
      id: 'coupon-1',
      active: true,
      startsAt: new Date(2000, 1, 1),
      expiresAt: null,
      minimumOrder: 100, // Exige 100, mas só tem 50
      maxUses: 0,
      usedCount: 0,
    } as any);

    await expect(
      useCase.execute({ tenantId, sessionId, code: 'MIN_ORDER' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should apply a fixed amount coupon and update session state', async () => {
    commerceRepo.findSessionById.mockResolvedValue({
      id: sessionId,
      tenantId,
      subtotalAmount: 100,
      freightAmount: 20,
      totalAmount: 120,
    } as any);

    salesRepo.findCouponByCode.mockResolvedValue({
      id: 'coupon-1',
      code: 'FIXED15',
      active: true,
      startsAt: new Date(2000, 1, 1),
      expiresAt: null,
      maxUses: 0,
      usedCount: 0,
      discountType: 'FIXED_AMOUNT',
      discountValue: 15,
      minimumOrder: null,
    } as any);

    await useCase.execute({ tenantId, sessionId, code: 'FIXED15' });

    expect(commerceRepo.updateSessionState).toHaveBeenCalledWith({
      tenantId,
      sessionId,
      couponCode: 'FIXED15',
      discountAmount: 15,
      totalAmount: 105, // 100 + 20 - 15
    });
  });

  it('should apply a percentage coupon and update session state', async () => {
    commerceRepo.findSessionById.mockResolvedValue({
      id: sessionId,
      tenantId,
      subtotalAmount: 200,
      freightAmount: 30,
      totalAmount: 230,
    } as any);

    salesRepo.findCouponByCode.mockResolvedValue({
      id: 'coupon-1',
      code: 'PCT10',
      active: true,
      startsAt: new Date(2000, 1, 1),
      expiresAt: null,
      maxUses: 0,
      usedCount: 0,
      discountType: 'PERCENTAGE',
      discountValue: 10,
      minimumOrder: 50,
    } as any);

    await useCase.execute({ tenantId, sessionId, code: 'PCT10' });

    expect(commerceRepo.updateSessionState).toHaveBeenCalledWith({
      tenantId,
      sessionId,
      couponCode: 'PCT10',
      discountAmount: 20, // 10% of 200
      totalAmount: 210, // 200 + 30 - 20
    });
  });
});
