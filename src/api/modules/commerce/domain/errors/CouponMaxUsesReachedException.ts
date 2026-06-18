import { ConflictException } from '@nestjs/common';

export class CouponMaxUsesReachedException extends ConflictException {
  constructor(couponId: string) {
    super(`Coupon ${couponId} has reached its maximum usage limit`);
  }
}
