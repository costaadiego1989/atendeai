import { Injectable, Inject } from '@nestjs/common';
import { SALES_REPOSITORY, ISalesPromotionRepository } from '../../domain/repositories/ISalesRepository';

@Injectable()
export class ListPromotionsUseCase {
  constructor(
    @Inject(SALES_REPOSITORY)
    private readonly repo: ISalesPromotionRepository,
  ) {}

  async execute(input: { tenantId: string; onlyActive?: boolean }) {
    return this.repo.listPromotions(input.tenantId, input.onlyActive);
  }
}
