import { Injectable } from '@nestjs/common';
import { PlatformProposalReadDao } from '../../../infrastructure/daos/PlatformProposalReadDao';

@Injectable()
export class GetPlatformProposalMetricsUseCase {
  constructor(private readonly dao: PlatformProposalReadDao) {}

  async execute(input: {
    period?: '1d' | '7d' | '30d' | '90d' | 'custom';
    startDate?: string;
    endDate?: string;
    tenantId?: string;
  }) {
    return this.dao.getMetrics(input);
  }
}
