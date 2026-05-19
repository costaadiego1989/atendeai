import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PlatformAdminApiKeyGuard } from '../guards/PlatformAdminApiKeyGuard';
import {
  GetPlatformSchedulingMetricsUseCase,
  ListPlatformRecurrencesUseCase,
} from '../../application/use-cases/metrics/GetPlatformSchedulingMetricsUseCase';
import {
  PlatformMetricsQueryDto,
  PlatformSchedulingQueryDto,
} from '../dtos/PlatformMetricsDTOs';

@Controller('platform/scheduling')
@UseGuards(PlatformAdminApiKeyGuard)
export class PlatformSchedulingController {
  constructor(
    private readonly getMetrics: GetPlatformSchedulingMetricsUseCase,
    private readonly listRecurrences: ListPlatformRecurrencesUseCase,
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

  @Get('reservations')
  async reservations(@Query() q: PlatformSchedulingQueryDto) {
    return this.listRecurrences.execute({
      page: q.page,
      limit: q.limit,
      tenantId: q.tenantId,
      status: q.status,
    });
  }
}
