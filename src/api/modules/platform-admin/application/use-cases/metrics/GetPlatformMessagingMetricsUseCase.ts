import { Injectable } from '@nestjs/common';
import { PlatformMessagingReadDao } from '../../../infrastructure/daos/PlatformMessagingReadDao';

@Injectable()
export class GetPlatformMessagingMetricsUseCase {
  constructor(private readonly dao: PlatformMessagingReadDao) {}

  async execute(input: {
    period?: '1d' | '7d' | '30d' | '90d' | 'custom';
    startDate?: string;
    endDate?: string;
    tenantId?: string;
  }) {
    return this.dao.getMetrics(input);
  }
}
