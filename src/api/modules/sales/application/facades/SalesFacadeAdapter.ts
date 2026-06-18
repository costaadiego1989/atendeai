import { Inject, Injectable } from '@nestjs/common';
import {
  ISalesCouponRepository,
  SALES_REPOSITORY,
  SalesCouponRecord,
} from '../../domain/repositories/ISalesRepository';
import { CouponRecord, ISalesFacade } from './ISalesFacade';

@Injectable()
export class SalesFacadeAdapter implements ISalesFacade {
  constructor(
    @Inject(SALES_REPOSITORY)
    private readonly salesCouponRepository: ISalesCouponRepository,
  ) {}

  async findCouponByCode(
    tenantId: string,
    code: string,
  ): Promise<CouponRecord | null> {
    const coupon = await this.salesCouponRepository.findCouponByCode(
      tenantId,
      code,
    );

    return coupon ? this.toCouponRecord(coupon) : null;
  }

  async incrementCouponUsage(
    tenantId: string,
    couponId: string,
  ): Promise<void> {
    await this.salesCouponRepository.incrementCouponUsage(tenantId, couponId);
  }

  async atomicIncrementCouponUsage(
    tenantId: string,
    couponId: string,
  ): Promise<CouponRecord | null> {
    const coupon = await this.salesCouponRepository.atomicIncrementCouponUsage(
      tenantId,
      couponId,
    );

    return coupon ? this.toCouponRecord(coupon) : null;
  }

  private toCouponRecord(coupon: SalesCouponRecord): CouponRecord {
    return {
      id: coupon.id,
      tenantId: coupon.tenantId,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxUses: coupon.maxUses ?? null,
      currentUses: coupon.usedCount,
      active: coupon.active,
      startsAt: coupon.startsAt,
      expiresAt: coupon.expiresAt ?? null,
      minimumOrder: coupon.minimumOrder ?? null,
    };
  }
}
