import { Injectable, Inject } from '@nestjs/common';
import { SALES_REPOSITORY, ISalesCouponRepository, SalesPromotionTargetRecord } from '../../domain/repositories/ISalesRepository';
import { randomUUID } from 'crypto';

export interface CreateCouponInput {
  tenantId: string;
  promotionId?: string | null;
  code: string;
  description?: string | null;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  maxUses: number; // 0 = unlimited
  startsAt: string;
  expiresAt?: string | null;
  catalogItemId?: string | null;
  targets?: SalesPromotionTargetRecord[];
}

@Injectable()
export class CreateCouponUseCase {
  constructor(
    @Inject(SALES_REPOSITORY)
    private readonly repo: ISalesCouponRepository,
  ) {}

  async execute(input: CreateCouponInput) {
    return this.repo.createCoupon({
      id: randomUUID(),
      tenantId: input.tenantId,
      promotionId: input.promotionId ?? null,
      code: input.code,
      description: input.description ?? null,
      discountType: input.discountType,
      discountValue: input.discountValue,
      maxUses: input.maxUses,
      startsAt: new Date(input.startsAt),
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      active: true,
      catalogItemId: input.catalogItemId ?? null,
      targets: input.targets ?? [],
    });
  }
}
