import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PlatformAdminApiKeyGuard } from '../guards/PlatformAdminApiKeyGuard';
import {
  GetPlatformContactsMetricsUseCase,
  ListPlatformContactsUseCase,
} from '../../application/use-cases/metrics/GetPlatformContactsMetricsUseCase';
import {
  PlatformContactsQueryDto,
  PlatformMetricsQueryDto,
} from '../dtos/PlatformMetricsDTOs';

@Controller('platform/contacts')
@UseGuards(PlatformAdminApiKeyGuard)
export class PlatformContactsController {
  constructor(
    private readonly getMetrics: GetPlatformContactsMetricsUseCase,
    private readonly listContacts: ListPlatformContactsUseCase,
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

  @Get()
  async list(@Query() q: PlatformContactsQueryDto) {
    return this.listContacts.execute({
      page: q.page,
      limit: q.limit,
      tenantId: q.tenantId,
      stage: q.stage,
      search: q.search,
    });
  }
}
