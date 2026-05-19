import { Injectable } from '@nestjs/common';
import { PlatformSalesReadDao } from '../../../infrastructure/daos/PlatformSalesReadDao';

@Injectable()
export class ListPlatformPaymentLinksUseCase {
  constructor(private readonly dao: PlatformSalesReadDao) {}

  async execute(input: {
    page: number;
    limit: number;
    tenantId?: string;
    status?: string;
    billingType?: string;
    period?: '1d' | '7d' | '30d' | '90d' | 'custom';
    startDate?: string;
    endDate?: string;
  }) {
    const safeLimit = Math.min(Math.max(input.limit, 1), 100);
    const safePage = Math.max(input.page, 1);
    const { items, total } = await this.dao.listPaymentLinks({
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
