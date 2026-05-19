import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PlatformAdminApiKeyGuard } from '../guards/PlatformAdminApiKeyGuard';
import { GetPlatformBillingMetricsUseCase } from '../../application/use-cases/metrics/GetPlatformBillingMetricsUseCase';
import { ListPlatformSubscriptionsUseCase } from '../../application/use-cases/metrics/ListPlatformSubscriptionsUseCase';
import { ListPlatformUsageUseCase } from '../../application/use-cases/metrics/ListPlatformUsageUseCase';
import {
  PlatformBillingQueryDto,
  PlatformMetricsQueryDto,
  PlatformPaginatedQueryDto,
} from '../dtos/PlatformMetricsDTOs';

@Controller('platform/billing')
@UseGuards(PlatformAdminApiKeyGuard)
export class PlatformBillingController {
  constructor(
    private readonly getMetrics: GetPlatformBillingMetricsUseCase,
    private readonly listSubscriptions: ListPlatformSubscriptionsUseCase,
    private readonly listUsage: ListPlatformUsageUseCase,
  ) {}

  @Get('metrics')
  async metrics(@Query() q: PlatformMetricsQueryDto) {
    return this.getMetrics.execute({
      period: q.period,
      startDate: q.startDate,
      endDate: q.endDate,
    });
  }

  @Get('subscriptions')
  async subscriptions(@Query() q: PlatformBillingQueryDto) {
    return this.listSubscriptions.execute({
      page: q.page,
      limit: q.limit,
      subscriptionStatus: q.subscriptionStatus,
      billingCycleType: q.billingCycleType,
      plan: q.plan,
    });
  }

  @Get('usage')
  async usage(@Query() q: PlatformPaginatedQueryDto) {
    return this.listUsage.execute({
      page: q.page,
      limit: q.limit,
      tenantId: q.tenantId,
    });
  }
}
