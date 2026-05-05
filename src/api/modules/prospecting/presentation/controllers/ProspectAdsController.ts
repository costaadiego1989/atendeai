import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { Roles } from '@shared/infrastructure/auth/decorators/roles.decorator';
import {
  CreateProspectAdsInsightQueryDTO,
  ImportProspectAdsLeadsDTO,
  ProspectAdsLeadsDTO,
  SelectGoogleAdsAccountDTO,
  SyncProspectAdsLeadsDTO,
} from '../dtos/ProspectSearchDTOs';
import {
  ICreateProspectAdsInsightQueryUseCase,
} from '../../application/use-cases/interfaces/ICreateProspectAdsInsightQueryUseCase';
import {
  IListProspectAdsInsightQueriesUseCase,
} from '../../application/use-cases/interfaces/IListProspectAdsInsightQueriesUseCase';
import {
  IListProspectAdsInsightResultsUseCase,
} from '../../application/use-cases/interfaces/IListProspectAdsInsightResultsUseCase';
import {
  ISyncProspectAdsLeadsUseCase,
} from '../../application/use-cases/interfaces/ISyncProspectAdsLeadsUseCase';
import {
  IListProspectLeadCapturesUseCase,
} from '../../application/use-cases/interfaces/IListProspectLeadCapturesUseCase';
import {
  IImportProspectLeadCapturesUseCase,
} from '../../application/use-cases/interfaces/IImportProspectLeadCapturesUseCase';
import {
  IProspectLeadCapturesUseCase,
} from '../../application/use-cases/interfaces/IProspectLeadCapturesUseCase';
import { StartGoogleAdsConnectionUseCase } from '../../application/use-cases/StartGoogleAdsConnectionUseCase';
import { GetGoogleAdsConnectionStatusUseCase } from '../../application/use-cases/GetGoogleAdsConnectionStatusUseCase';
import { ListGoogleAdsAccessibleAccountsUseCase } from '../../application/use-cases/ListGoogleAdsAccessibleAccountsUseCase';
import { SelectGoogleAdsAccountUseCase } from '../../application/use-cases/SelectGoogleAdsAccountUseCase';
import { DisconnectGoogleAdsConnectionUseCase } from '../../application/use-cases/DisconnectGoogleAdsConnectionUseCase';
import { CompleteGoogleAdsConnectionUseCase } from '../../application/use-cases/CompleteGoogleAdsConnectionUseCase';
import { Response } from 'express';

@Controller('prospecting/ads')
export class ProspectAdsController {
  constructor(
    @Inject(ICreateProspectAdsInsightQueryUseCase)
    private readonly createInsightQueryUseCase: ICreateProspectAdsInsightQueryUseCase,
    @Inject(IListProspectAdsInsightQueriesUseCase)
    private readonly listInsightQueriesUseCase: IListProspectAdsInsightQueriesUseCase,
    @Inject(IListProspectAdsInsightResultsUseCase)
    private readonly listInsightResultsUseCase: IListProspectAdsInsightResultsUseCase,
    @Inject(ISyncProspectAdsLeadsUseCase)
    private readonly syncProspectAdsLeadsUseCase: ISyncProspectAdsLeadsUseCase,
    @Inject(IListProspectLeadCapturesUseCase)
    private readonly listProspectLeadCapturesUseCase: IListProspectLeadCapturesUseCase,
    @Inject(IImportProspectLeadCapturesUseCase)
    private readonly importProspectLeadCapturesUseCase: IImportProspectLeadCapturesUseCase,
    @Inject(IProspectLeadCapturesUseCase)
    private readonly prospectLeadCapturesUseCase: IProspectLeadCapturesUseCase,
    private readonly startGoogleAdsConnectionUseCase: StartGoogleAdsConnectionUseCase,
    private readonly getGoogleAdsConnectionStatusUseCase: GetGoogleAdsConnectionStatusUseCase,
    private readonly listGoogleAdsAccessibleAccountsUseCase: ListGoogleAdsAccessibleAccountsUseCase,
    private readonly selectGoogleAdsAccountUseCase: SelectGoogleAdsAccountUseCase,
    private readonly disconnectGoogleAdsConnectionUseCase: DisconnectGoogleAdsConnectionUseCase,
    private readonly completeGoogleAdsConnectionUseCase: CompleteGoogleAdsConnectionUseCase,
  ) {}

  @Get('connection/status')
  @UseGuards(JwtCookieGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async getConnectionStatus(@Req() req: any) {
    return this.getGoogleAdsConnectionStatusUseCase.execute({
      tenantId: req.user.tenantId,
    });
  }

  @Post('connection/start')
  @UseGuards(JwtCookieGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async startConnection(@Req() req: any) {
    return this.startGoogleAdsConnectionUseCase.execute({
      tenantId: req.user.tenantId,
    });
  }

  @Get('connection/callback')
  async completeConnection(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    if (error) {
      res.type('html').send(this.buildPopupHtml(false, error));
      return;
    }

    try {
      await this.completeGoogleAdsConnectionUseCase.execute({
        code,
        state,
      });
      res.type('html').send(this.buildPopupHtml(true));
    } catch (callbackError: any) {
      res
        .type('html')
        .send(
          this.buildPopupHtml(
            false,
            callbackError?.message || 'Falha ao conectar Google Ads',
          ),
        );
    }
  }

  @Get('connection/accounts')
  @UseGuards(JwtCookieGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async listAccessibleAccounts(@Req() req: any) {
    return this.listGoogleAdsAccessibleAccountsUseCase.execute({
      tenantId: req.user.tenantId,
    });
  }

  @Post('connection/select-account')
  @UseGuards(JwtCookieGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async selectAccount(@Req() req: any, @Body() body: SelectGoogleAdsAccountDTO) {
    return this.selectGoogleAdsAccountUseCase.execute({
      tenantId: req.user.tenantId,
      customerId: body.customerId,
    });
  }

  @Delete('connection')
  @UseGuards(JwtCookieGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async disconnect(@Req() req: any) {
    return this.disconnectGoogleAdsConnectionUseCase.execute({
      tenantId: req.user.tenantId,
    });
  }

  @Post('insights/queries')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtCookieGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async createInsightQuery(@Req() req: any, @Body() body: CreateProspectAdsInsightQueryDTO) {
    return this.createInsightQueryUseCase.execute({
      tenantId: req.user.tenantId,
      ...body,
    });
  }

  @Get('insights/queries')
  @UseGuards(JwtCookieGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async listInsightQueries(@Req() req: any) {
    return this.listInsightQueriesUseCase.execute({
      tenantId: req.user.tenantId,
    });
  }

  @Get('insights/queries/:id/results')
  @UseGuards(JwtCookieGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async listInsightResults(@Req() req: any, @Param('id') id: string) {
    return this.listInsightResultsUseCase.execute({
      tenantId: req.user.tenantId,
      queryId: id,
    });
  }

  @Post('leads/sync')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtCookieGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async syncLeads(@Req() req: any, @Body() body: SyncProspectAdsLeadsDTO) {
    return this.syncProspectAdsLeadsUseCase.execute({
      tenantId: req.user.tenantId,
      limit: body.limit,
    });
  }

  @Get('leads')
  @UseGuards(JwtCookieGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async listLeads(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('campaignName') campaignName?: string,
    @Query('importStatus') importStatus?: string,
    @Query('channel') channel?: 'WHATSAPP' | 'INSTAGRAM',
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.listProspectLeadCapturesUseCase.execute({
      tenantId: req.user.tenantId,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      campaignName,
      importStatus,
      channel,
      dateFrom,
      dateTo,
    });
  }

  @Post('leads/import-contacts')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtCookieGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async importLeads(@Req() req: any, @Body() body: ImportProspectAdsLeadsDTO) {
    return this.importProspectLeadCapturesUseCase.execute({
      tenantId: req.user.tenantId,
      leadIds: body.leadIds,
    });
  }

  @Post('leads/prospect')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtCookieGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async prospectLeads(@Req() req: any, @Body() body: ProspectAdsLeadsDTO) {
    return this.prospectLeadCapturesUseCase.execute({
      tenantId: req.user.tenantId,
      leadIds: body.leadIds,
      messageTemplate: body.messageTemplate,
      campaignName: body.campaignName,
      objective: body.objective,
      channel: body.channel,
    });
  }

  private buildPopupHtml(success: boolean, message?: string): string {
    return `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Google Ads</title>
        </head>
        <body style="font-family: Arial, sans-serif; padding: 24px;">
          <script>
            (function () {
              try {
                if (window.opener) {
                  window.opener.postMessage(
                    {
                      source: 'atendeai-google-ads-oauth',
                      success: ${success ? 'true' : 'false'},
                      message: ${JSON.stringify(message || '')}
                    },
                    '*'
                  );
                }
              } catch (error) {}
              window.close();
            })();
          </script>
          <p>${success ? 'Google Ads conectado. Pode voltar ao AtendeAi.' : (message || 'Falha ao conectar Google Ads.')}</p>
        </body>
      </html>
    `;
  }
}
