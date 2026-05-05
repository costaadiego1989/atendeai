import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { SALES_REPOSITORY, ISalesCouponRepository, SalesPromotionTargetRecord } from '../../domain/repositories/ISalesRepository';

export interface UpdateCouponInput {
  tenantId: string;
  couponId: string;
  code?: string;
  description?: string | null;
  discountType?: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue?: number;
  maxUses?: number;
  startsAt?: string;
  expiresAt?: string | null;
  active?: boolean;
  catalogItemId?: string | null;
  targets?: SalesPromotionTargetRecord[];
  promotionId?: string | null;
}

@Injectable()
export class UpdateCouponUseCase {
  constructor(
    @Inject(SALES_REPOSITORY)
    private readonly repo: ISalesCouponRepository,
  ) {}

  async execute(input: UpdateCouponInput) {
    const data: Record<string, any> = {};
    if (input.code !== undefined) data.code = input.code;
    if (input.description !== undefined) data.description = input.description;
    if (input.discountType !== undefined) data.discountType = input.discountType;
    if (input.discountValue !== undefined) data.discountValue = input.discountValue;
    if (input.maxUses !== undefined) data.maxUses = input.maxUses;
    if (input.startsAt !== undefined) data.startsAt = new Date(input.startsAt);
    if (input.expiresAt !== undefined) data.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (input.active !== undefined) data.active = input.active;
    if (input.catalogItemId !== undefined) data.catalogItemId = input.catalogItemId;
    if (input.targets !== undefined) data.targets = input.targets;
    if (input.promotionId !== undefined) data.promotionId = input.promotionId;

    const result = await this.repo.updateCoupon(input.tenantId, input.couponId, data);
    if (!result) throw new NotFoundException('Coupon not found');
    return result;
  }
}
