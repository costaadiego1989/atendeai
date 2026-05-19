import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PlatformAdminApiKeyGuard } from '../guards/PlatformAdminApiKeyGuard';
import { GetPlatformSocialMetricsUseCase } from '../../application/use-cases/metrics/GetPlatformSocialMetricsUseCase';
import { PlatformMetricsQueryDto } from '../dtos/PlatformMetricsDTOs';

@Controller('platform/social')
@UseGuards(PlatformAdminApiKeyGuard)
export class PlatformSocialController {
  constructor(private readonly getMetrics: GetPlatformSocialMetricsUseCase) {}

  @Get('metrics')
  async metrics(@Query() q: PlatformMetricsQueryDto) {
    return this.getMetrics.execute({
      period: q.period,
      startDate: q.startDate,
      endDate: q.endDate,
      tenantId: q.tenantId,
    });
  }
}
