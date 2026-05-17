import { RedeemCouponUseCase } from '../application/use-cases/RedeemCouponUseCase';
import { ISalesCouponRepository } from '../domain/repositories/ISalesRepository';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('RedeemCouponUseCase', () => {
  let useCase: RedeemCouponUseCase;
  let repoMock: jest.Mocked<ISalesCouponRepository>;

  beforeEach(() => {
    repoMock = {
      findCouponByCode: jest.fn(),
      findCouponById: jest.fn(),
      incrementCouponUsage: jest.fn(),
    } as unknown as jest.Mocked<ISalesCouponRepository>;

    useCase = new RedeemCouponUseCase(repoMock);
  });

  const validCoupon = {
    id: 'id-123',
    tenantId: 'tenant-1',
    code: 'VALID',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    maxUses: 0,
    usedCount: 0,
    startsAt: new Date(Date.now() - 10000), // active
    expiresAt: null,
    active: true,
  };

  it('should redeem a valid unlimited coupon by code', async () => {
    // @ts-ignore
    repoMock.findCouponByCode.mockResolvedValueOnce(validCoupon);
    repoMock.incrementCouponUsage.mockResolvedValueOnce({
      ...validCoupon,
      usedCount: 1,
    } as any);

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      code: 'VALID',
    });

    expect(result.discount.value).toBe(10);
    expect(result.coupon!.usedCount).toBe(1);
    expect(repoMock.incrementCouponUsage).toHaveBeenCalledWith(
      'tenant-1',
      'id-123',
    );
  });

  it('should throw NotFoundException if coupon does not exist', async () => {
    repoMock.findCouponByCode.mockResolvedValueOnce(null);

    await expect(
      useCase.execute({ tenantId: 't1', code: 'INVALID' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException if coupon is inactive', async () => {
    // @ts-ignore
    repoMock.findCouponByCode.mockResolvedValueOnce({
      ...validCoupon,
      active: false,
    });

    await expect(
      useCase.execute({ tenantId: 't1', code: 'VALID' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException if max uses reached', async () => {
    // @ts-ignore
    repoMock.findCouponByCode.mockResolvedValueOnce({
      ...validCoupon,
      maxUses: 2,
      usedCount: 2,
    });

    await expect(
      useCase.execute({ tenantId: 't1', code: 'VALID' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException if coupon starts in the future', async () => {
    // @ts-ignore
    repoMock.findCouponByCode.mockResolvedValueOnce({
      ...validCoupon,
      startsAt: new Date(Date.now() + 8640000),
    });

    await expect(
      useCase.execute({ tenantId: 't1', code: 'VALID' }),
    ).rejects.toThrow(BadRequestException);
  });
});
