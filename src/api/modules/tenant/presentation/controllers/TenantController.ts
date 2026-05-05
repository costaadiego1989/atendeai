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
  Query,
} from '@nestjs/common';
import { Request } from 'express';
import { ICreateTenantUseCase } from '../../application/use-cases/interfaces/ICreateTenantUseCase';
import { IConfigureWhatsAppUseCase } from '../../application/use-cases/interfaces/IConfigureWhatsAppUseCase';
import { IConfigureInstagramUseCase } from '../../application/use-cases/interfaces/IConfigureInstagramUseCase';
import { IConfigureAIUseCase } from '../../application/use-cases/interfaces/IConfigureAIUseCase';
import {
  CreateTenantDTO,
  ConfigureWhatsAppDTO,
  ConfigureInstagramDTO,
  ConfigureAIDTO,
  UpdateBusinessDataDTO,
  AddPromotionDTO,
  UpdatePromotionDTO,
  RegisterTwilioWhatsAppSenderDTO,
  VerifyTwilioWhatsAppSenderDTO,
  CreateTenantBranchDTO,
  UpdateTenantBranchDTO,
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
import { GetWhatsAppConnectionUseCase } from '../../application/use-cases/GetWhatsAppConnectionUseCase';
import { RegisterTwilioWhatsAppSenderUseCase } from '../../application/use-cases/RegisterTwilioWhatsAppSenderUseCase';
import { VerifyTwilioWhatsAppSenderUseCase } from '../../application/use-cases/VerifyTwilioWhatsAppSenderUseCase';
import { RefreshTwilioWhatsAppSenderStatusUseCase } from '../../application/use-cases/RefreshTwilioWhatsAppSenderStatusUseCase';
import { CreateTenantBranchUseCase } from '../../application/use-cases/CreateTenantBranchUseCase';
import { UpdateTenantBranchUseCase } from '../../application/use-cases/UpdateTenantBranchUseCase';
import { DeleteTenantBranchUseCase } from '../../application/use-cases/DeleteTenantBranchUseCase';
import { UpsertTenantPDFResumeUseCase } from '../../application/use-cases/UpsertTenantPDFResumeUseCase';
import { ListTenantPDFResumesUseCase } from '../../application/use-cases/ListTenantPDFResumesUseCase';

@Controller('tenants')
@TenantParam('id')
export class TenantController {
  constructor(
    @Inject(ICreateTenantUseCase)
    private readonly createTenantUseCase: ICreateTenantUseCase,
    @Inject(IConfigureWhatsAppUseCase)
    private readonly configureWhatsAppUseCase: IConfigureWhatsAppUseCase,
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
    private readonly getWhatsAppConnectionUseCase: GetWhatsAppConnectionUseCase,
    private readonly registerTwilioWhatsAppSenderUseCase: RegisterTwilioWhatsAppSenderUseCase,
    private readonly verifyTwilioWhatsAppSenderUseCase: VerifyTwilioWhatsAppSenderUseCase,
    private readonly refreshTwilioWhatsAppSenderStatusUseCase: RefreshTwilioWhatsAppSenderStatusUseCase,
    private readonly createTenantBranchUseCase: CreateTenantBranchUseCase,
    private readonly updateTenantBranchUseCase: UpdateTenantBranchUseCase,
    private readonly deleteTenantBranchUseCase: DeleteTenantBranchUseCase,
    private readonly upsertTenantPDFResumeUseCase: UpsertTenantPDFResumeUseCase,
    private readonly listTenantPDFResumesUseCase: ListTenantPDFResumesUseCase,
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

  @Get(':id/whatsapp-connection')
  @UseGuards(JwtCookieGuard, TenantGuard)
  async getWhatsAppConnection(
    @Param('id') id: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.getWhatsAppConnectionUseCase.execute(id, branchId);
  }

  @Put(':id/whatsapp-config')
  @UseGuards(JwtCookieGuard, RolesGuard, TenantGuard)
  @Roles('OWNER', 'ADMIN')
  async updateWhatsAppConfig(
    @Param('id') id: string,
    @Body() body: ConfigureWhatsAppDTO,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    return this.configureWhatsAppUseCase.execute({
      ...body,
      tenantId: id,
      requestingUserId: user?.sub,
      requestingUserEmail: user?.email,
    });
  }

  @Post(':id/whatsapp/twilio/sender')
  @UseGuards(JwtCookieGuard, RolesGuard, TenantGuard)
  @Roles('OWNER', 'ADMIN')
  async registerTwilioWhatsAppSender(
    @Param('id') id: string,
    @Body() body: RegisterTwilioWhatsAppSenderDTO,
  ) {
    return this.registerTwilioWhatsAppSenderUseCase.execute({
      ...body,
      tenantId: id,
    });
  }

  @Post(':id/whatsapp/twilio/verify')
  @UseGuards(JwtCookieGuard, RolesGuard, TenantGuard)
  @Roles('OWNER', 'ADMIN')
  async verifyTwilioWhatsAppSender(
    @Param('id') id: string,
    @Body() body: VerifyTwilioWhatsAppSenderDTO,
  ) {
    return this.verifyTwilioWhatsAppSenderUseCase.execute({
      ...body,
      tenantId: id,
    });
  }

  @Post(':id/whatsapp/twilio/refresh')
  @UseGuards(JwtCookieGuard, RolesGuard, TenantGuard)
  @Roles('OWNER', 'ADMIN')
  async refreshTwilioWhatsAppSender(
    @Param('id') id: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.refreshTwilioWhatsAppSenderStatusUseCase.execute(id, branchId);
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

  @Put(':id/ai-config')
  @UseGuards(JwtCookieGuard, RolesGuard, TenantGuard)
  @Roles('OWNER', 'ADMIN')
  async updateAIConfig(@Param('id') id: string, @Body() body: ConfigureAIDTO, @Req() req: Request) {
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
  async addPromotion(@Param('id') id: string, @Body() body: AddPromotionDTO, @Req() req: Request) {
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

  @Post(':id/branches')
  @UseGuards(JwtCookieGuard, RolesGuard, TenantGuard)
  @Roles('OWNER', 'ADMIN')
  async createBranch(@Param('id') id: string, @Body() body: CreateTenantBranchDTO, @Req() req: Request) {
    const user = (req as any).user;
    return this.createTenantBranchUseCase.execute({
      ...body,
      tenantId: id,
      whatsAppConfigOverride: body.whatsAppProvider
        ? {
            provider: body.whatsAppProvider,
            credentials: body.whatsAppCredentials ?? {},
            webhookSecret: body.whatsAppWebhookSecret,
          }
        : null,
      requestingUserId: user?.sub,
      requestingUserEmail: user?.email,
    });
  }

  @Put(':id/branches/:branchId')
  @UseGuards(JwtCookieGuard, RolesGuard, TenantGuard)
  @Roles('OWNER', 'ADMIN')
  async updateBranch(
    @Param('id') id: string,
    @Param('branchId') branchId: string,
    @Body() body: UpdateTenantBranchDTO,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    return this.updateTenantBranchUseCase.execute({
      ...body,
      tenantId: id,
      branchId,
      whatsAppConfigOverride: body.whatsAppProvider
        ? {
            provider: body.whatsAppProvider,
            credentials: body.whatsAppCredentials ?? {},
            webhookSecret: body.whatsAppWebhookSecret,
          }
        : null,
      requestingUserId: user?.sub,
      requestingUserEmail: user?.email,
    });
  }

  @Delete(':id/branches/:branchId')
  @UseGuards(JwtCookieGuard, RolesGuard, TenantGuard)
  @Roles('OWNER', 'ADMIN')
  async deleteBranch(
    @Param('id') id: string,
    @Param('branchId') branchId: string,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    return this.deleteTenantBranchUseCase.execute({
      tenantId: id,
      branchId,
      requestingUserId: user?.sub,
      requestingUserEmail: user?.email,
    });
  }
}
