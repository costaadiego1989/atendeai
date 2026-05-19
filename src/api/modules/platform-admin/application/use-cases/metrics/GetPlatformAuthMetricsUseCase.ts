import { Injectable } from '@nestjs/common';
import { PlatformAuthReadDao } from '../../../infrastructure/daos/PlatformAuthReadDao';

@Injectable()
export class GetPlatformAuthMetricsUseCase {
  constructor(private readonly dao: PlatformAuthReadDao) {}

  async execute(input: {
    period?: '1d' | '7d' | '30d' | '90d' | 'custom';
    startDate?: string;
    endDate?: string;
    tenantId?: string;
  }) {
    return this.dao.getMetrics(input);
  }
}
