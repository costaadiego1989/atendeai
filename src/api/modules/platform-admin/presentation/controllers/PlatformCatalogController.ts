import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PlatformAdminApiKeyGuard } from '../guards/PlatformAdminApiKeyGuard';
import { GetPlatformCatalogMetricsUseCase } from '../../application/use-cases/metrics/GetPlatformCatalogMetricsUseCase';
import { PlatformMetricsQueryDto } from '../dtos/PlatformMetricsDTOs';

@Controller('platform/catalog')
@UseGuards(PlatformAdminApiKeyGuard)
export class PlatformCatalogController {
  constructor(private readonly getMetrics: GetPlatformCatalogMetricsUseCase) {}

  @Get('metrics')
  async metrics(@Query() q: PlatformMetricsQueryDto) {
    return this.getMetrics.execute({
      tenantId: q.tenantId,
    });
  }
}
