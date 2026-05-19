import { Injectable } from '@nestjs/common';
import { PlatformRecoveryReadDao } from '../../../infrastructure/daos/PlatformRecoveryReadDao';

@Injectable()
export class GetPlatformRecoveryMetricsUseCase {
  constructor(private readonly dao: PlatformRecoveryReadDao) {}

  async execute(input: {
    period?: '1d' | '7d' | '30d' | '90d' | 'custom';
    startDate?: string;
    endDate?: string;
    tenantId?: string;
  }) {
    return this.dao.getMetrics(input);
  }
}

@Injectable()
export class ListPlatformRecoveryCasesUseCase {
  constructor(private readonly dao: PlatformRecoveryReadDao) {}

  async execute(input: {
    page: number;
    limit: number;
    tenantId?: string;
    status?: string;
    source?: string;
  }) {
    const safeLimit = Math.min(Math.max(input.limit, 1), 100);
    const safePage = Math.max(input.page, 1);
    const { items, total } = await this.dao.listCases({
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
