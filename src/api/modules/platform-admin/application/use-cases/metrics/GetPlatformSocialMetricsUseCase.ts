import { Injectable } from '@nestjs/common';
import { PlatformSocialReadDao } from '../../../infrastructure/daos/PlatformSocialReadDao';

@Injectable()
export class GetPlatformSocialMetricsUseCase {
  constructor(private readonly dao: PlatformSocialReadDao) {}

  async execute(input: {
    period?: '1d' | '7d' | '30d' | '90d' | 'custom';
    startDate?: string;
    endDate?: string;
    tenantId?: string;
  }) {
    return this.dao.getMetrics(input);
  }
}
