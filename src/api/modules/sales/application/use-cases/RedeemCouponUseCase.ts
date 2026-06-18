import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  SALES_REPOSITORY,
  ISalesCouponRepository,
} from '../../domain/repositories/ISalesRepository';

@Injectable()
export class RedeemCouponUseCase {
  constructor(
    @Inject(SALES_REPOSITORY)
    private readonly repo: ISalesCouponRepository,
  ) {}

  async execute(input: { tenantId: string; couponId?: string; code?: string }) {
    let coupon;

    if (input.code) {
      coupon = await this.repo.findCouponByCode(input.tenantId, input.code);
    } else if (input.couponId) {
      coupon = await this.repo.findCouponById(input.tenantId, input.couponId);
    }

    if (!coupon) throw new NotFoundException('Coupon not found');
    if (!coupon.active) throw new BadRequestException('Coupon is inactive');

    const now = new Date();
    if (now < coupon.startsAt)
      throw new BadRequestException('Coupon has not started yet');
    if (coupon.expiresAt && now > coupon.expiresAt)
      throw new BadRequestException('Coupon has expired');

    // Fast-fail pre-check (non-authoritative — the atomic op below is authoritative)
    if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException('Coupon usage limit reached');
    }

    // COM1 fix: use atomic conditional increment to prevent over-use under concurrency
    let updated;
    if (coupon.maxUses > 0) {
      updated = await this.repo.atomicIncrementCouponUsage(
        input.tenantId,
        coupon.id,
      );
      if (!updated) {
        throw new ConflictException('Coupon usage limit reached');
      }
    } else {
      // Unlimited coupon — safe to use plain increment
      updated = await this.repo.incrementCouponUsage(input.tenantId, coupon.id);
    }

    return {
      coupon: updated,
      discount: {
        type: coupon.discountType,
        value: coupon.discountValue,
      },
    };
  }
}
