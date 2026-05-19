import { Injectable } from '@nestjs/common';
import { PlatformDashboardReadDao } from '../../../infrastructure/daos/PlatformDashboardReadDao';

@Injectable()
export class GetPlatformDashboardOverviewUseCase {
  constructor(private readonly dao: PlatformDashboardReadDao) {}

  async execute(input: {
    period?: '1d' | '7d' | '30d' | '90d' | 'custom';
    startDate?: string;
    endDate?: string;
    plan?: string;
    planStatus?: string;
  }) {
    return this.dao.getOverview(input);
  }
}
