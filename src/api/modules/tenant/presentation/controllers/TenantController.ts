import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Delete,
  UseGuards,
  Inject,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ICreateTenantUseCase } from '../../application/use-cases/interfaces/ICreateTenantUseCase';
import { IConfigureInstagramUseCase } from '../../application/use-cases/interfaces/IConfigureInstagramUseCase';
import { IConfigureAIUseCase } from '../../application/use-cases/interfaces/IConfigureAIUseCase';
import {
  CreateTenantDTO,
  ConfigureInstagramDTO,
  ConfigureAIDTO,
  UpdateBusinessDataDTO,
  AddPromotionDTO,
  UpdatePromotionDTO,
  UpsertTenantPDFResumeDTO,
} from '../dtos/TenantDTOs';
import { IUpdateBusinessDataUseCase } from '../../application/use-cases/interfaces/IUpdateBusinessDataUseCase';
import { AddPromotionUseCase } from '../../application/use-cases/AddPromotionUseCase';
import { UpdatePromotionUseCase } from '../../application/use-cases/UpdatePromotionUseCase';
import { DeletePromotionUseCase } from '../../application/use-cases/DeletePromotionUseCase';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { Roles } from '@shared/infrastructure/auth/decorators/roles.decorator';
import { TenantGuard } from '@shared/infrastructure/auth/guards/TenantGuard';
import { TenantParam } from '@shared/infrastructure/auth/decorators/tenant-param.decorator';
import { IGetTenantDetailsUseCase } from '../../application/use-cases/interfaces/IGetTenantDetailsUseCase';
import { IGetTenantSettingsUseCase } from '../../application/use-cases/interfaces/IGetTenantSettingsUseCase';
import { IGetTenantProfileSectionsUseCase } from '../../application/use-cases/interfaces/IGetTenantProfileSectionsUseCase';
import { IGetTenantOnboardingChecklistUseCase } from '../../application/use-cases/interfaces/IGetTenantOnboardingChecklistUseCase';
import { UpsertTenantPDFResumeUseCase } from '../../application/use-cases/UpsertTenantPDFResumeUseCase';
import { ListTenantPDFResumesUseCase } from '../../application/use-cases/ListTenantPDFResumesUseCase';
import { DisconnectInstagramUseCase } from '../../application/use-cases/DisconnectInstagramUseCase';

@Controller('tenants')
@TenantParam('id')
export class TenantController {
  constructor(
    @Inject(ICreateTenantUseCase)
    private readonly createTenantUseCase: ICreateTenantUseCase,
    @Inject(IConfigureInstagramUseCase)
    private readonly configureInstagramUseCase: IConfigureInstagramUseCase,
    @Inject(IConfigureAIUseCase)
    private readonly configureAIUseCase: IConfigureAIUseCase,
    @Inject(IUpdateBusinessDataUseCase)
    private readonly updateBusinessDataUseCase: IUpdateBusinessDataUseCase,
    @Inject(IGetTenantDetailsUseCase)
    private readonly getTenantDetailsUseCase: IGetTenantDetailsUseCase,
    @Inject(IGetTenantSettingsUseCase)
    private readonly getTenantSettingsUseCase: IGetTenantSettingsUseCase,
    @Inject(IGetTenantProfileSectionsUseCase)
    private readonly getTenantProfileSectionsUseCase: IGetTenantProfileSectionsUseCase,
    @Inject(IGetTenantOnboardingChecklistUseCase)
    private readonly getTenantOnboardingChecklistUseCase: IGetTenantOnboardingChecklistUseCase,
    private readonly addPromotionUseCase: AddPromotionUseCase,
    private readonly updatePromotionUseCase: UpdatePromotionUseCase,
    private readonly deletePromotionUseCase: DeletePromotionUseCase,
    private readonly upsertTenantPDFResumeUseCase: UpsertTenantPDFResumeUseCase,
    private readonly listTenantPDFResumesUseCase: ListTenantPDFResumesUseCase,
    private readonly disconnectInstagramUseCase: DisconnectInstagramUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: CreateTenantDTO) {
    return this.createTenantUseCase.execute(body);
  }

  @Get(':id')
  @UseGuards(JwtCookieGuard, TenantGuard)
  async getById(@Param('id') id: string) {
    return this.getTenantDetailsUseCase.execute(id);
  }

  @Get(':id/settings')
  @UseGuards(JwtCookieGuard, TenantGuard)
  async getSettings(@Param('id') id: string) {
    return this.getTenantSettingsUseCase.execute(id);
  }

  @Get(':id/profile-sections')
  @UseGuards(JwtCookieGuard, TenantGuard)
  async getProfileSections(@Param('id') id: string) {
    return this.getTenantProfileSectionsUseCase.execute(id);
  }

  @Get(':id/onboarding-checklist')
  @UseGuards(JwtCookieGuard, TenantGuard)
  async getOnboardingChecklist(@Param('id') id: string) {
    return this.getTenantOnboardingChecklistUseCase.execute(id);
  }

  @Put(':id/instagram-config')
  @UseGuards(JwtCookieGuard, RolesGuard, TenantGuard)
  @Roles('OWNER', 'ADMIN')
  async updateInstagramConfig(
    @Param('id') id: string,
    @Body() body: ConfigureInstagramDTO,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    return this.configureInstagramUseCase.execute({
      ...body,
      tenantId: id,
      requestingUserId: user?.sub,
      requestingUserEmail: user?.email,
    });
  }

  @Delete(':id/instagram-config')
  @UseGuards(JwtCookieGuard, RolesGuard, TenantGuard)
  @Roles('OWNER', 'ADMIN')
  async deleteInstagramConfig(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    const branchId = (req.query as any)?.branchId;
    return this.disconnectInstagramUseCase.execute({
      tenantId: id,
      branchId: branchId || undefined,
      requestingUserId: user?.sub,
      requestingUserEmail: user?.email,
    });
  }

  @Put(':id/ai-config')
  @UseGuards(JwtCookieGuard, RolesGuard, TenantGuard)
  @Roles('OWNER', 'ADMIN')
  async updateAIConfig(
    @Param('id') id: string,
    @Body() body: ConfigureAIDTO,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    return this.configureAIUseCase.execute({
      ...body,
      tenantId: id,
      requestingUserId: user?.sub,
      requestingUserEmail: user?.email,
    });
  }

  @Put(':id/business-data')
  @UseGuards(JwtCookieGuard, RolesGuard, TenantGuard)
  @Roles('OWNER', 'ADMIN')
  async updateBusinessData(
    @Param('id') id: string,
    @Body() body: UpdateBusinessDataDTO,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    return this.updateBusinessDataUseCase.execute({
      ...body,
      tenantId: id,
      requestingUserId: user?.sub,
      requestingUserEmail: user?.email,
    });
  }

  @Get(':id/pdf-resumes')
  @UseGuards(JwtCookieGuard, TenantGuard)
  async listPDFResumes(@Param('id') id: string) {
    return this.listTenantPDFResumesUseCase.execute(id);
  }

  @Post(':id/pdf-resumes')
  @UseGuards(JwtCookieGuard, RolesGuard, TenantGuard)
  @Roles('OWNER', 'ADMIN')
  async upsertPDFResume(
    @Param('id') id: string,
    @Body() body: UpsertTenantPDFResumeDTO,
  ) {
    return this.upsertTenantPDFResumeUseCase.execute({
      ...body,
      tenantId: id,
    });
  }

  @Post(':id/promotions')
  @UseGuards(JwtCookieGuard, RolesGuard, TenantGuard)
  @Roles('OWNER', 'ADMIN')
  async addPromotion(
    @Param('id') id: string,
    @Body() body: AddPromotionDTO,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    return this.addPromotionUseCase.execute({
      ...body,
      tenantId: id,
      requestingUserId: user?.sub,
      requestingUserEmail: user?.email,
    });
  }

  @Put(':id/promotions/:promotionId')
  @UseGuards(JwtCookieGuard, RolesGuard, TenantGuard)
  @Roles('OWNER', 'ADMIN')
  async updatePromotion(
    @Param('id') id: string,
    @Param('promotionId') promotionId: string,
    @Body() body: UpdatePromotionDTO,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    return this.updatePromotionUseCase.execute({
      ...body,
      tenantId: id,
      promotionId,
      requestingUserId: user?.sub,
      requestingUserEmail: user?.email,
    });
  }

  @Delete(':id/promotions/:promotionId')
  @UseGuards(JwtCookieGuard, RolesGuard, TenantGuard)
  @Roles('OWNER', 'ADMIN')
  async deletePromotion(
    @Param('id') id: string,
    @Param('promotionId') promotionId: string,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    return this.deletePromotionUseCase.execute({
      tenantId: id,
      promotionId,
      requestingUserId: user?.sub,
      requestingUserEmail: user?.email,
    });
  }
}
