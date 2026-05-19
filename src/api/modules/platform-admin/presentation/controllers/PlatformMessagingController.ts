import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PlatformAdminApiKeyGuard } from '../guards/PlatformAdminApiKeyGuard';
import { GetPlatformMessagingMetricsUseCase } from '../../application/use-cases/metrics/GetPlatformMessagingMetricsUseCase';
import { ListPlatformConversationsUseCase } from '../../application/use-cases/metrics/ListPlatformConversationsUseCase';
import {
  PlatformMessagingQueryDto,
  PlatformMetricsQueryDto,
} from '../dtos/PlatformMetricsDTOs';

@Controller('platform/messaging')
@UseGuards(PlatformAdminApiKeyGuard)
export class PlatformMessagingController {
  constructor(
    private readonly getMetrics: GetPlatformMessagingMetricsUseCase,
    private readonly listConversations: ListPlatformConversationsUseCase,
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

  @Get('conversations')
  async conversations(@Query() q: PlatformMessagingQueryDto) {
    return this.listConversations.execute({
      page: q.page,
      limit: q.limit,
      tenantId: q.tenantId,
      channel: q.channel,
      status: q.status,
      contactSearch: q.contactSearch,
    });
  }
}
