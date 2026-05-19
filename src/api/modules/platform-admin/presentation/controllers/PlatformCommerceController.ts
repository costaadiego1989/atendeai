import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PlatformAdminApiKeyGuard } from '../guards/PlatformAdminApiKeyGuard';
import { GetPlatformCommerceMetricsUseCase } from '../../application/use-cases/metrics/GetPlatformCommerceMetricsUseCase';
import { PlatformMetricsQueryDto } from '../dtos/PlatformMetricsDTOs';

@Controller('platform/commerce')
@UseGuards(PlatformAdminApiKeyGuard)
export class PlatformCommerceController {
  constructor(private readonly getMetrics: GetPlatformCommerceMetricsUseCase) {}

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
