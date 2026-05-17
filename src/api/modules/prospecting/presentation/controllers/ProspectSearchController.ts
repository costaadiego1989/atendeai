import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { Roles } from '@shared/infrastructure/auth/decorators/roles.decorator';
import { ICreateProspectSearchUseCase } from '../../application/use-cases/interfaces/ICreateProspectSearchUseCase';
import { IListProspectSearchesUseCase } from '../../application/use-cases/interfaces/IListProspectSearchesUseCase';
import { IListProspectSearchResultsUseCase } from '../../application/use-cases/interfaces/IListProspectSearchResultsUseCase';
import { IImportProspectSearchResultsUseCase } from '../../application/use-cases/interfaces/IImportProspectSearchResultsUseCase';
import { IProspectSelectedSearchResultsUseCase } from '../../application/use-cases/interfaces/IProspectSelectedSearchResultsUseCase';
import {
  CreateProspectSearchDTO,
  ImportProspectSearchResultsDTO,
  ProspectSelectedSearchResultsDTO,
} from '../dtos/ProspectSearchDTOs';
import { Param } from '@nestjs/common';

@Controller('prospecting/searches')
@UseGuards(JwtCookieGuard, RolesGuard)
export class ProspectSearchController {
  constructor(
    @Inject(ICreateProspectSearchUseCase)
    private readonly createProspectSearchUseCase: ICreateProspectSearchUseCase,
    @Inject(IListProspectSearchesUseCase)
    private readonly listProspectSearchesUseCase: IListProspectSearchesUseCase,
    @Inject(IListProspectSearchResultsUseCase)
    private readonly listProspectSearchResultsUseCase: IListProspectSearchResultsUseCase,
    @Inject(IImportProspectSearchResultsUseCase)
    private readonly importProspectSearchResultsUseCase: IImportProspectSearchResultsUseCase,
    @Inject(IProspectSelectedSearchResultsUseCase)
    private readonly prospectSelectedSearchResultsUseCase: IProspectSelectedSearchResultsUseCase,
  ) {}

  @Get()
  @Roles('OWNER', 'ADMIN')
  async list(@Req() req: any) {
    return this.listProspectSearchesUseCase.execute({
      tenantId: req.user.tenantId,
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('OWNER', 'ADMIN')
  async create(@Req() req: any, @Body() body: CreateProspectSearchDTO) {
    return this.createProspectSearchUseCase.execute({
      tenantId: req.user.tenantId,
      ...body,
    });
  }

  @Get(':id/results')
  @Roles('OWNER', 'ADMIN')
  async listResults(@Req() req: any, @Param('id') id: string) {
    return this.listProspectSearchResultsUseCase.execute({
      tenantId: req.user.tenantId,
      searchId: id,
    });
  }

  @Post(':id/import-contacts')
  @HttpCode(HttpStatus.CREATED)
  @Roles('OWNER', 'ADMIN')
  async importContacts(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: ImportProspectSearchResultsDTO,
    @Query('branchId') branchId?: string,
  ) {
    return this.importProspectSearchResultsUseCase.execute({
      tenantId: req.user.tenantId,
      searchId: id,
      branchId,
      resultIds: body?.resultIds,
    });
  }

  @Post(':id/prospect')
  @HttpCode(HttpStatus.CREATED)
  @Roles('OWNER', 'ADMIN')
  async prospect(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: ProspectSelectedSearchResultsDTO,
  ) {
    return this.prospectSelectedSearchResultsUseCase.execute({
      tenantId: req.user.tenantId,
      searchId: id,
      resultIds: body.resultIds,
      messageTemplate: body.messageTemplate,
      campaignName: body.campaignName,
      objective: body.objective,
      channel: body.channel,
      dispatchMode: body.dispatchMode,
    });
  }
}
