import { Injectable } from '@nestjs/common';
import { PlatformPaymentReadDao } from '../../../infrastructure/daos/PlatformPaymentReadDao';

@Injectable()
export class GetPlatformPaymentMetricsUseCase {
  constructor(private readonly dao: PlatformPaymentReadDao) {}

  async execute(input: {
    period?: '1d' | '7d' | '30d' | '90d' | 'custom';
    startDate?: string;
    endDate?: string;
    tenantId?: string;
  }) {
    return this.dao.getMetrics(input);
  }
}
