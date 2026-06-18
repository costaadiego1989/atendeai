import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  COMMERCE_REPOSITORY,
  ICommerceRepository,
} from '../../domain/ports/ICommerceRepository';
import {
  SALES_REPOSITORY,
  ISalesCouponRepository,
} from '@modules/sales/domain/repositories/ISalesRepository';
import { CouponMaxUsesReachedException } from '../../domain/errors/CouponMaxUsesReachedException';

export interface ApplyCouponToShoppingSessionInput {
  tenantId: string;
  sessionId: string;
  code: string;
}

@Injectable()
export class ApplyCouponToShoppingSessionUseCase {
  constructor(
    @Inject(COMMERCE_REPOSITORY)
    private readonly commerceRepository: ICommerceRepository,
    @Inject(SALES_REPOSITORY)
    private readonly salesRepository: ISalesCouponRepository,
  ) {}

  async execute(input: ApplyCouponToShoppingSessionInput) {
    const session = await this.commerceRepository.findSessionById(
      input.tenantId,
      input.sessionId,
    );
    if (!session) {
      throw new NotFoundException('Shopping session not found');
    }

    const coupon = await this.salesRepository.findCouponByCode(
      input.tenantId,
      input.code,
    );
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    if (!coupon.active) {
      throw new BadRequestException('Coupon is inactive');
    }

    const now = new Date();
    if (now < coupon.startsAt) {
      throw new BadRequestException('Coupon has not started yet');
    }
    if (coupon.expiresAt && now > coupon.expiresAt) {
      throw new BadRequestException('Coupon has expired');
    }

    // Fast-fail pre-check (non-authoritative — still racy but avoids unnecessary
    // DB round-trips for clearly exhausted coupons)
    if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException('Coupon usage limit reached');
    }

    if (coupon.minimumOrder && session.subtotalAmount < coupon.minimumOrder) {
      throw new BadRequestException(
        `Minimum order amount of BRL ${coupon.minimumOrder} not met`,
      );
    }

    // COM1 fix: atomically increment only when used_count < max_uses AND active.
    // Returns null if the race was lost (coupon exhausted between pre-check and here).
    if (coupon.maxUses > 0) {
      const incremented = await this.salesRepository.atomicIncrementCouponUsage(
        input.tenantId,
        coupon.id,
      );
      if (!incremented) {
        throw new CouponMaxUsesReachedException(coupon.id);
      }
    }

    // Compute discount against current session subtotal only — never persist a
    // stale absolute amount. The session state update below stores the live value.
    let discountAmount = 0;
    if (coupon.discountType === 'FIXED_AMOUNT') {
      discountAmount = coupon.discountValue;
    } else if (coupon.discountType === 'PERCENTAGE') {
      discountAmount = (session.subtotalAmount * coupon.discountValue) / 100;
    }

    const gross = session.subtotalAmount + (session.freightAmount ?? 0);
    // COM4: floor total to 0 (domain entity enforces throw on discount > gross)
    const totalAmount = Math.max(0, gross - discountAmount);

    return await this.commerceRepository.updateSessionState({
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      couponCode: coupon.code,
      discountAmount,
      totalAmount,
    });
  }
}
