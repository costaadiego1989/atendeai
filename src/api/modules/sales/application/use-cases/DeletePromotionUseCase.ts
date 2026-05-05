import { Injectable, Inject } from '@nestjs/common';
import { SALES_REPOSITORY, ISalesPromotionRepository } from '../../domain/repositories/ISalesRepository';

@Injectable()
export class DeletePromotionUseCase {
  constructor(
    @Inject(SALES_REPOSITORY)
    private readonly repo: ISalesPromotionRepository,
  ) {}

  async execute(input: { tenantId: string; promotionId: string }) {
    await this.repo.deletePromotion(input.tenantId, input.promotionId);
    return { deleted: true };
  }
}
