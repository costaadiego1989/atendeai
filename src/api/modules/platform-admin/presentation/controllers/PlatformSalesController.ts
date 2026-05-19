import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PlatformAdminApiKeyGuard } from '../guards/PlatformAdminApiKeyGuard';
import { GetPlatformSalesMetricsUseCase } from '../../application/use-cases/metrics/GetPlatformSalesMetricsUseCase';
import { ListPlatformPaymentLinksUseCase } from '../../application/use-cases/metrics/ListPlatformPaymentLinksUseCase';
import {
  PlatformMetricsQueryDto,
  PlatformSalesQueryDto,
} from '../dtos/PlatformMetricsDTOs';

@Controller('platform/sales')
@UseGuards(PlatformAdminApiKeyGuard)
export class PlatformSalesController {
  constructor(
    private readonly getMetrics: GetPlatformSalesMetricsUseCase,
    private readonly listPaymentLinks: ListPlatformPaymentLinksUseCase,
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

  @Get('payment-links')
  async paymentLinks(@Query() q: PlatformSalesQueryDto) {
    return this.listPaymentLinks.execute({
      page: q.page,
      limit: q.limit,
      tenantId: q.tenantId,
      status: q.linkStatus,
      billingType: q.billingType,
      period: q.period,
      startDate: q.startDate,
      endDate: q.endDate,
    });
  }
}
