import { Injectable } from '@nestjs/common';
import { PlatformBillingReadDao } from '../../../infrastructure/daos/PlatformBillingReadDao';

@Injectable()
export class ListPlatformUsageUseCase {
  constructor(private readonly dao: PlatformBillingReadDao) {}

  async execute(input: { page: number; limit: number; tenantId?: string }) {
    const safeLimit = Math.min(Math.max(input.limit, 1), 100);
    const safePage = Math.max(input.page, 1);
    const { items, total } = await this.dao.listUsage({
      ...input,
      page: safePage,
      limit: safeLimit,
    });
    return {
      items,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    };
  }
}
