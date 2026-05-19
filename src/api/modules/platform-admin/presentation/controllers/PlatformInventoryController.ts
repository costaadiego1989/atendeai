import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PlatformAdminApiKeyGuard } from '../guards/PlatformAdminApiKeyGuard';
import { GetPlatformInventoryMetricsUseCase } from '../../application/use-cases/metrics/GetPlatformInventoryMetricsUseCase';
import { PlatformMetricsQueryDto } from '../dtos/PlatformMetricsDTOs';

@Controller('platform/inventory')
@UseGuards(PlatformAdminApiKeyGuard)
export class PlatformInventoryController {
  constructor(
    private readonly getMetrics: GetPlatformInventoryMetricsUseCase,
  ) {}

  @Get('metrics')
  async metrics(@Query() q: PlatformMetricsQueryDto) {
    return this.getMetrics.execute({
      tenantId: q.tenantId,
    });
  }
}
