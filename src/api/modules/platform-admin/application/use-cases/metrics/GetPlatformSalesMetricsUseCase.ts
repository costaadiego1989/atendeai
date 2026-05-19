import { Injectable } from '@nestjs/common';
import { PlatformSalesReadDao } from '../../../infrastructure/daos/PlatformSalesReadDao';

@Injectable()
export class GetPlatformSalesMetricsUseCase {
  constructor(private readonly dao: PlatformSalesReadDao) {}

  async execute(input: {
    period?: '1d' | '7d' | '30d' | '90d' | 'custom';
    startDate?: string;
    endDate?: string;
    tenantId?: string;
  }) {
    return this.dao.getMetrics(input);
  }
}
