import { Injectable, NotFoundException } from '@nestjs/common';
import { PlatformTenantsMetricsReadDao } from '../../../infrastructure/daos/PlatformTenantsMetricsReadDao';

@Injectable()
export class GetPlatformTenantsMetricsUseCase {
  constructor(private readonly dao: PlatformTenantsMetricsReadDao) {}

  async execute(input: {
    period?: '1d' | '7d' | '30d' | '90d' | 'custom';
    startDate?: string;
    endDate?: string;
  }) {
    return this.dao.getMetrics(input);
  }
}

@Injectable()
export class GetPlatformTenantDetailUseCase {
  constructor(private readonly dao: PlatformTenantsMetricsReadDao) {}

  async execute(input: { tenantId: string }) {
    const detail = await this.dao.getTenantDetail(input.tenantId);
    if (!detail) {
      throw new NotFoundException('Tenant not found');
    }
    return detail;
  }
}
