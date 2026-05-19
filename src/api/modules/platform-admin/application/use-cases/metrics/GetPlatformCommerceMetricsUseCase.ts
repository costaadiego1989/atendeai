import { Injectable } from '@nestjs/common';
import { PlatformCommerceReadDao } from '../../../infrastructure/daos/PlatformCommerceReadDao';

@Injectable()
export class GetPlatformCommerceMetricsUseCase {
  constructor(private readonly dao: PlatformCommerceReadDao) {}

  async execute(input: {
    period?: '1d' | '7d' | '30d' | '90d' | 'custom';
    startDate?: string;
    endDate?: string;
    tenantId?: string;
  }) {
    return this.dao.getMetrics(input);
  }
}
