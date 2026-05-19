import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PlatformAdminApiKeyGuard } from '../guards/PlatformAdminApiKeyGuard';
import {
  GetPlatformAIMetricsUseCase,
  ListPlatformAISessionsUseCase,
} from '../../application/use-cases/metrics/GetPlatformAIMetricsUseCase';
import {
  PlatformAIQueryDto,
  PlatformMetricsQueryDto,
} from '../dtos/PlatformMetricsDTOs';

@Controller('platform/ai')
@UseGuards(PlatformAdminApiKeyGuard)
export class PlatformAIController {
  constructor(
    private readonly getMetrics: GetPlatformAIMetricsUseCase,
    private readonly listSessions: ListPlatformAISessionsUseCase,
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

  @Get('sessions')
  async sessions(@Query() q: PlatformAIQueryDto) {
    return this.listSessions.execute({
      page: q.page,
      limit: q.limit,
      tenantId: q.tenantId,
      intent: q.intent,
      sentiment: q.sentiment,
    });
  }
}
