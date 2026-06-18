export const SALES_FACADE = 'SALES_FACADE';

export interface CouponRecord {
  id: string;
  tenantId: string;
  code: string;
  discountType: string;
  discountValue: number;
  maxUses: number | null;
  currentUses: number;
  active: boolean;
  startsAt: Date;
  expiresAt: Date | null;
  minimumOrder: number | null;
}

export interface ISalesFacade {
  findCouponByCode(
    tenantId: string,
    code: string,
  ): Promise<CouponRecord | null>;
  /** Non-atomic increment — use only when atomicity is not required. */
  incrementCouponUsage(tenantId: string, couponId: string): Promise<void>;
  /**
   * Atomically increments used_count only when used_count < max_uses AND active.
   * Returns the updated record, or null if the coupon is exhausted/inactive/not found.
   */
  atomicIncrementCouponUsage(
    tenantId: string,
    couponId: string,
  ): Promise<CouponRecord | null>;
}
