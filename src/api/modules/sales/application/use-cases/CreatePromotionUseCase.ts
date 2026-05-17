import { Injectable, Inject } from '@nestjs/common';
import {
  SALES_REPOSITORY,
  ISalesPromotionRepository,
  SalesPromotionTargetRecord,
} from '../../domain/repositories/ISalesRepository';
import { randomUUID } from 'crypto';

export interface CreatePromotionInput {
  tenantId: string;
  title: string;
  description: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  minimumOrder?: number | null;
  imageUrl?: string | null;
  startsAt: string;
  expiresAt?: string | null;
  catalogItemId?: string | null;
  targets?: SalesPromotionTargetRecord[];
}

@Injectable()
export class CreatePromotionUseCase {
  constructor(
    @Inject(SALES_REPOSITORY)
    private readonly repo: ISalesPromotionRepository,
  ) {}

  async execute(input: CreatePromotionInput) {
    return this.repo.createPromotion({
      id: randomUUID(),
      tenantId: input.tenantId,
      title: input.title,
      description: input.description,
      discountType: input.discountType,
      discountValue: input.discountValue,
      minimumOrder: input.minimumOrder ?? null,
      imageUrl: input.imageUrl ?? null,
      startsAt: new Date(input.startsAt),
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      active: true,
      catalogItemId: input.catalogItemId ?? null,
      targets: input.targets ?? [],
    });
  }
}
