import { Injectable } from '@nestjs/common';
import { PlatformBillingReadDao } from '../../../infrastructure/daos/PlatformBillingReadDao';

@Injectable()
export class GetPlatformBillingMetricsUseCase {
  constructor(private readonly dao: PlatformBillingReadDao) {}

  async execute(input: {
    period?: '1d' | '7d' | '30d' | '90d' | 'custom';
    startDate?: string;
    endDate?: string;
  }) {
    return this.dao.getMetrics(input);
  }
}
