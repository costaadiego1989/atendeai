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
  AdjustQuotasBodyDto,
  DraftMessageBodyDto,
  ListPlatformTenantsQueryDto,
  SendManualMessageBodyDto,
} from '../dtos/PlatformAdminDTOs';

@Controller('platform/tenants')
@UseGuards(PlatformAdminApiKeyGuard)
export class PlatformTenantsController {
  constructor(
    private readonly listOverview: ListPlatformTenantsOverviewUseCase,
    private readonly adjustQuotas: AdjustTenantSubscriptionQuotasUseCase,
    private readonly draftMessage: DraftTenantAdminMessageUseCase,
    private readonly sendManual: SendTenantManualWhatsAppUseCase,
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
}
