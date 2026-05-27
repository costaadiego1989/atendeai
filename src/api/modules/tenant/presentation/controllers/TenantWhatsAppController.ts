import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { IConfigureWhatsAppUseCase } from '../../application/use-cases/interfaces/IConfigureWhatsAppUseCase';
import { Inject } from '@nestjs/common';
import {
  ConfigureWhatsAppDTO,
  RegisterTwilioWhatsAppSenderDTO,
  VerifyTwilioWhatsAppSenderDTO,
} from '../dtos/TenantDTOs';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { Roles } from '@shared/infrastructure/auth/decorators/roles.decorator';
import { TenantGuard } from '@shared/infrastructure/auth/guards/TenantGuard';
import { TenantParam } from '@shared/infrastructure/auth/decorators/tenant-param.decorator';
import { GetWhatsAppConnectionUseCase } from '../../application/use-cases/GetWhatsAppConnectionUseCase';
import { RegisterTwilioWhatsAppSenderUseCase } from '../../application/use-cases/RegisterTwilioWhatsAppSenderUseCase';
import { VerifyTwilioWhatsAppSenderUseCase } from '../../application/use-cases/VerifyTwilioWhatsAppSenderUseCase';
import { RefreshTwilioWhatsAppSenderStatusUseCase } from '../../application/use-cases/RefreshTwilioWhatsAppSenderStatusUseCase';

@Controller('tenants')
@TenantParam('id')
export class TenantWhatsAppController {
  constructor(
    @Inject(IConfigureWhatsAppUseCase)
    private readonly configureWhatsAppUseCase: IConfigureWhatsAppUseCase,
    private readonly getWhatsAppConnectionUseCase: GetWhatsAppConnectionUseCase,
    private readonly registerTwilioWhatsAppSenderUseCase: RegisterTwilioWhatsAppSenderUseCase,
    private readonly verifyTwilioWhatsAppSenderUseCase: VerifyTwilioWhatsAppSenderUseCase,
    private readonly refreshTwilioWhatsAppSenderStatusUseCase: RefreshTwilioWhatsAppSenderStatusUseCase,
  ) {}

  @Get(':id/whatsapp-connection')
  @UseGuards(JwtCookieGuard, TenantGuard)
  async getWhatsAppConnection(
    @Param('id') id: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.getWhatsAppConnectionUseCase.execute({
      tenantId: id,
      branchId,
    });
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
    return this.refreshTwilioWhatsAppSenderStatusUseCase.execute({
      tenantId: id,
      branchId,
    });
  }
}
