import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  SALES_REPOSITORY,
  ISalesPromotionRepository,
  SalesPromotionTargetRecord,
} from '../../domain/repositories/ISalesRepository';

export interface UpdatePromotionInput {
  tenantId: string;
  promotionId: string;
  title?: string;
  description?: string;
  discountType?: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue?: number;
  minimumOrder?: number | null;
  imageUrl?: string | null;
  startsAt?: string;
  expiresAt?: string | null;
  active?: boolean;
  catalogItemId?: string | null;
  targets?: SalesPromotionTargetRecord[];
}

@Injectable()
export class UpdatePromotionUseCase {
  constructor(
    @Inject(SALES_REPOSITORY)
    private readonly repo: ISalesPromotionRepository,
  ) {}

  async execute(input: UpdatePromotionInput) {
    const data: Record<string, any> = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.discountType !== undefined)
      data.discountType = input.discountType;
    if (input.discountValue !== undefined)
      data.discountValue = input.discountValue;
    if (input.minimumOrder !== undefined)
      data.minimumOrder = input.minimumOrder;
    if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl;
    if (input.startsAt !== undefined) data.startsAt = new Date(input.startsAt);
    if (input.expiresAt !== undefined)
      data.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (input.active !== undefined) data.active = input.active;
    if (input.catalogItemId !== undefined)
      data.catalogItemId = input.catalogItemId;
    if (input.targets !== undefined) data.targets = input.targets;

    const result = await this.repo.updatePromotion(
      input.tenantId,
      input.promotionId,
      data,
    );
    if (!result) throw new NotFoundException('Promotion not found');
    return result;
  }
}
