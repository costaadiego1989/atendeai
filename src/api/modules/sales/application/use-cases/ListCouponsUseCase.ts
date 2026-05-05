import { Injectable, Inject } from '@nestjs/common';
import { SALES_REPOSITORY, ISalesCouponRepository } from '../../domain/repositories/ISalesRepository';

@Injectable()
export class ListCouponsUseCase {
  constructor(
    @Inject(SALES_REPOSITORY)
    private readonly repo: ISalesCouponRepository,
  ) {}

  async execute(input: { tenantId: string; onlyActive?: boolean }) {
    return this.repo.listCoupons(input.tenantId, input.onlyActive);
  }
}
