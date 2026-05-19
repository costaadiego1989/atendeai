import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PlatformAdminApiKeyGuard } from '../guards/PlatformAdminApiKeyGuard';
import { GetPlatformPaymentMetricsUseCase } from '../../application/use-cases/metrics/GetPlatformPaymentMetricsUseCase';
import { PlatformMetricsQueryDto } from '../dtos/PlatformMetricsDTOs';

@Controller('platform/payment')
@UseGuards(PlatformAdminApiKeyGuard)
export class PlatformPaymentController {
  constructor(private readonly getMetrics: GetPlatformPaymentMetricsUseCase) {}

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
