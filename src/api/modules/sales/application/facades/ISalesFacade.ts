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
}

export interface ISalesFacade {
  findCouponByCode(
    tenantId: string,
    code: string,
  ): Promise<CouponRecord | null>;
  incrementCouponUsage(tenantId: string, couponId: string): Promise<void>;
}
