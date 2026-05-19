import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PlatformAdminApiKeyGuard } from '../guards/PlatformAdminApiKeyGuard';
import { GetPlatformSupportMetricsUseCase } from '../../application/use-cases/metrics/GetPlatformSupportMetricsUseCase';
import { PlatformMetricsQueryDto } from '../dtos/PlatformMetricsDTOs';

@Controller('platform/support')
@UseGuards(PlatformAdminApiKeyGuard)
export class PlatformSupportMetricsController {
  constructor(private readonly getMetrics: GetPlatformSupportMetricsUseCase) {}

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
