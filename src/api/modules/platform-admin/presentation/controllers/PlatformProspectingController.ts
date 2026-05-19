import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PlatformAdminApiKeyGuard } from '../guards/PlatformAdminApiKeyGuard';
import {
  GetPlatformProspectingMetricsUseCase,
  ListPlatformCampaignsUseCase,
} from '../../application/use-cases/metrics/GetPlatformProspectingMetricsUseCase';
import {
  PlatformMetricsQueryDto,
  PlatformProspectingQueryDto,
} from '../dtos/PlatformMetricsDTOs';

@Controller('platform/prospecting')
@UseGuards(PlatformAdminApiKeyGuard)
export class PlatformProspectingController {
  constructor(
    private readonly getMetrics: GetPlatformProspectingMetricsUseCase,
    private readonly listCampaigns: ListPlatformCampaignsUseCase,
  ) {}

  @Get('metrics')
  async metrics(@Query() q: PlatformMetricsQueryDto) {
    return this.getMetrics.execute({
      period: q.period,
      startDate: q.startDate,
      endDate: q.endDate,
      tenantId: q.tenantId,
    });
  }

  @Get('campaigns')
  async campaigns(@Query() q: PlatformProspectingQueryDto) {
    return this.listCampaigns.execute({
      page: q.page,
      limit: q.limit,
      tenantId: q.tenantId,
      status: q.status,
    });
  }
}
