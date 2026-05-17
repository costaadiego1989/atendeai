import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { Roles } from '@shared/infrastructure/auth/decorators/roles.decorator';
import { ICreateProspectCampaignUseCase } from '../../application/use-cases/interfaces/ICreateProspectCampaignUseCase';
import { IListProspectCampaignsUseCase } from '../../application/use-cases/interfaces/IListProspectCampaignsUseCase';
import { IActivateProspectCampaignUseCase } from '../../application/use-cases/interfaces/IActivateProspectCampaignUseCase';
import { IPauseProspectCampaignUseCase } from '../../application/use-cases/interfaces/IPauseProspectCampaignUseCase';
import { IStartProspectCampaignUseCase } from '../../application/use-cases/interfaces/IStartProspectCampaignUseCase';
import { IDispatchNextProspectCampaignExecutionUseCase } from '../../application/use-cases/interfaces/IDispatchNextProspectCampaignExecutionUseCase';
import { ISuggestProspectCampaignMessageUseCase } from '../../application/use-cases/interfaces/ISuggestProspectCampaignMessageUseCase';
import {
  CreateProspectCampaignDTO,
  SuggestProspectCampaignMessageDTO,
} from '../dtos/ProspectCampaignDTOs';

@Controller('prospecting/campaigns')
@UseGuards(JwtCookieGuard, RolesGuard)
export class ProspectCampaignController {
  constructor(
    @Inject(ICreateProspectCampaignUseCase)
    private readonly createProspectCampaignUseCase: ICreateProspectCampaignUseCase,
    @Inject(IListProspectCampaignsUseCase)
    private readonly listProspectCampaignsUseCase: IListProspectCampaignsUseCase,
    @Inject(IActivateProspectCampaignUseCase)
    private readonly activateProspectCampaignUseCase: IActivateProspectCampaignUseCase,
    @Inject(IPauseProspectCampaignUseCase)
    private readonly pauseProspectCampaignUseCase: IPauseProspectCampaignUseCase,
    @Inject(IStartProspectCampaignUseCase)
    private readonly startProspectCampaignUseCase: IStartProspectCampaignUseCase,
    @Inject(IDispatchNextProspectCampaignExecutionUseCase)
    private readonly dispatchNextProspectCampaignExecutionUseCase: IDispatchNextProspectCampaignExecutionUseCase,
    @Inject(ISuggestProspectCampaignMessageUseCase)
    private readonly suggestProspectCampaignMessageUseCase: ISuggestProspectCampaignMessageUseCase,
  ) {}

  @Get()
  @Roles('OWNER', 'ADMIN')
  async list(@Req() req: any) {
    return this.listProspectCampaignsUseCase.execute({
      tenantId: req.user.tenantId,
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('OWNER', 'ADMIN')
  async create(@Req() req: any, @Body() body: CreateProspectCampaignDTO) {
    return this.createProspectCampaignUseCase.execute({
      tenantId: req.user.tenantId,
      ...body,
    });
  }

  @Post('message-suggestion')
  @Roles('OWNER', 'ADMIN')
  async suggestMessage(
    @Req() req: any,
    @Body() body: SuggestProspectCampaignMessageDTO,
    @Query('branchId') branchId?: string,
  ) {
    return this.suggestProspectCampaignMessageUseCase.execute({
      tenantId: req.user.tenantId,
      branchId,
      objective: body.objective,
      audienceType: body.audienceType,
      channels: body.channels,
      stageFilter: body.stageFilter,
      searchTerm: body.searchTerm,
      selectedCount: body.selectedCount,
      selectedContacts: body.selectedContacts ?? [],
    });
  }

  @Patch(':id/activate')
  @Roles('OWNER', 'ADMIN')
  async activate(@Req() req: any, @Param('id') id: string) {
    return this.activateProspectCampaignUseCase.execute({
      tenantId: req.user.tenantId,
      campaignId: id,
    });
  }

  @Patch(':id/pause')
  @Roles('OWNER', 'ADMIN')
  async pause(@Req() req: any, @Param('id') id: string) {
    return this.pauseProspectCampaignUseCase.execute({
      tenantId: req.user.tenantId,
      campaignId: id,
    });
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.CREATED)
  @Roles('OWNER', 'ADMIN')
  async start(@Req() req: any, @Param('id') id: string) {
    return this.startProspectCampaignUseCase.execute({
      tenantId: req.user.tenantId,
      campaignId: id,
    });
  }

  @Post(':id/dispatch-next')
  @HttpCode(HttpStatus.CREATED)
  @Roles('OWNER', 'ADMIN')
  async dispatchNext(@Req() req: any, @Param('id') id: string) {
    return this.dispatchNextProspectCampaignExecutionUseCase.execute({
      tenantId: req.user.tenantId,
      campaignId: id,
    });
  }
}
