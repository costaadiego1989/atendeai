import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PlatformAdminApiKeyGuard } from '../guards/PlatformAdminApiKeyGuard';
import { ListPlatformTenantsOverviewUseCase } from '../../application/use-cases/ListPlatformTenantsOverviewUseCase';
import { AdjustTenantSubscriptionQuotasUseCase } from '../../application/use-cases/AdjustTenantSubscriptionQuotasUseCase';
import { DraftTenantAdminMessageUseCase } from '../../application/use-cases/DraftTenantAdminMessageUseCase';
import { SendTenantManualWhatsAppUseCase } from '../../application/use-cases/SendTenantManualWhatsAppUseCase';
import {
  GetPlatformTenantsMetricsUseCase,
  GetPlatformTenantDetailUseCase,
} from '../../application/use-cases/metrics/GetPlatformTenantsMetricsUseCase';
import {
  AdjustQuotasBodyDto,
  DraftMessageBodyDto,
  ListPlatformTenantsQueryDto,
  SendManualMessageBodyDto,
} from '../dtos/PlatformAdminDTOs';
import { PlatformMetricsQueryDto } from '../dtos/PlatformMetricsDTOs';

@Controller('platform/tenants')
@UseGuards(PlatformAdminApiKeyGuard)
export class PlatformTenantsController {
  constructor(
    private readonly listOverview: ListPlatformTenantsOverviewUseCase,
    private readonly adjustQuotas: AdjustTenantSubscriptionQuotasUseCase,
    private readonly draftMessage: DraftTenantAdminMessageUseCase,
    private readonly sendManual: SendTenantManualWhatsAppUseCase,
    private readonly getTenantsMetrics: GetPlatformTenantsMetricsUseCase,
    private readonly getTenantDetail: GetPlatformTenantDetailUseCase,
  ) {}

  @Get()
  async list(@Query() q: ListPlatformTenantsQueryDto) {
    return this.listOverview.execute({ page: q.page, limit: q.limit });
  }

  @Patch(':tenantId/quotas')
  async patchQuotas(
    @Param('tenantId') tenantId: string,
    @Body() body: AdjustQuotasBodyDto,
  ) {
    return this.adjustQuotas.execute({
      tenantId,
      messages: body.messages,
      aiTokens: body.aiTokens,
      contacts: body.contacts,
    });
  }

  @Post(':tenantId/messages/draft')
  async draft(
    @Param('tenantId') tenantId: string,
    @Body() body: DraftMessageBodyDto,
  ) {
    return this.draftMessage.execute({
      intent: body.intent,
      locale: 'pt-BR',
      tenantSummary: `${body.tenantSummary}\n(tenantId=${tenantId})`,
      operatorHint: body.operatorHint,
    });
  }

  @Post(':tenantId/messages/send')
  async send(
    @Param('tenantId') tenantId: string,
    @Body() body: SendManualMessageBodyDto,
  ) {
    return this.sendManual.execute({ tenantId, text: body.text });
  }

  @Get('metrics')
  async metrics(@Query() q: PlatformMetricsQueryDto) {
    return this.getTenantsMetrics.execute({
      period: q.period,
      startDate: q.startDate,
      endDate: q.endDate,
    });
  }

  @Get(':tenantId/details')
  async details(@Param('tenantId') tenantId: string) {
    return this.getTenantDetail.execute({ tenantId });
  }
}
