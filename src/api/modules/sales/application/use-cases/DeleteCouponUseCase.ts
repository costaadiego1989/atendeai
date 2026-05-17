import { Injectable, Inject } from '@nestjs/common';
import {
  SALES_REPOSITORY,
  ISalesCouponRepository,
} from '../../domain/repositories/ISalesRepository';

@Injectable()
export class DeleteCouponUseCase {
  constructor(
    @Inject(SALES_REPOSITORY)
    private readonly repo: ISalesCouponRepository,
  ) {}

  async execute(input: { tenantId: string; couponId: string }) {
    await this.repo.deleteCoupon(input.tenantId, input.couponId);
    return { deleted: true };
  }
}
