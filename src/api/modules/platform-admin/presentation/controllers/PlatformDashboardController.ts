import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PlatformAdminApiKeyGuard } from '../guards/PlatformAdminApiKeyGuard';
import { GetPlatformDashboardOverviewUseCase } from '../../application/use-cases/metrics/GetPlatformDashboardOverviewUseCase';
import { PlatformMetricsQueryDto } from '../dtos/PlatformMetricsDTOs';

@Controller('platform/dashboard')
@UseGuards(PlatformAdminApiKeyGuard)
export class PlatformDashboardController {
  constructor(
    private readonly getOverview: GetPlatformDashboardOverviewUseCase,
  ) {}

  @Get('overview')
  async overview(@Query() q: PlatformMetricsQueryDto) {
    return this.getOverview.execute({
      period: q.period,
      startDate: q.startDate,
      endDate: q.endDate,
      plan: q.plan,
      planStatus: q.planStatus,
    });
  }
}
