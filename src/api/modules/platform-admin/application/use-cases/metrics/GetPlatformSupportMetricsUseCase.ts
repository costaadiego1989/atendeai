import { Injectable } from '@nestjs/common';
import { PlatformSupportMetricsReadDao } from '../../../infrastructure/daos/PlatformSupportMetricsReadDao';

@Injectable()
export class GetPlatformSupportMetricsUseCase {
  constructor(private readonly dao: PlatformSupportMetricsReadDao) {}

  async execute(input: {
    period?: '1d' | '7d' | '30d' | '90d' | 'custom';
    startDate?: string;
    endDate?: string;
    tenantId?: string;
  }) {
    return this.dao.getMetrics(input);
  }
}
