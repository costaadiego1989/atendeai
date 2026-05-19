import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PlatformAdminApiKeyGuard } from '../guards/PlatformAdminApiKeyGuard';
import {
  GetPlatformRecoveryMetricsUseCase,
  ListPlatformRecoveryCasesUseCase,
} from '../../application/use-cases/metrics/GetPlatformRecoveryMetricsUseCase';
import {
  PlatformMetricsQueryDto,
  PlatformRecoveryQueryDto,
} from '../dtos/PlatformMetricsDTOs';

@Controller('platform/recovery')
@UseGuards(PlatformAdminApiKeyGuard)
export class PlatformRecoveryController {
  constructor(
    private readonly getMetrics: GetPlatformRecoveryMetricsUseCase,
    private readonly listCases: ListPlatformRecoveryCasesUseCase,
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

  @Get('cases')
  async cases(@Query() q: PlatformRecoveryQueryDto) {
    return this.listCases.execute({
      page: q.page,
      limit: q.limit,
      tenantId: q.tenantId,
      status: q.status,
      source: q.source,
    });
  }
}
