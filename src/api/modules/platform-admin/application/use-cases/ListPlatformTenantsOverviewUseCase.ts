import { Injectable } from '@nestjs/common';
import { PlatformTenantBillingReadDao } from '../../infrastructure/PlatformTenantBillingReadDao';

@Injectable()
export class ListPlatformTenantsOverviewUseCase {
  constructor(private readonly dao: PlatformTenantBillingReadDao) {}

  async execute(input: { page: number; limit: number }) {
    const safeLimit = Math.min(Math.max(input.limit, 1), 100);
    const safePage = Math.max(input.page, 1);
    const { items, total } = await this.dao.listOverview({
      page: safePage,
      limit: safeLimit,
    });
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));
    return {
      items,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages,
    };
  }
}
