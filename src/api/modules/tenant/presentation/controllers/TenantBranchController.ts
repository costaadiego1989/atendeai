import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
  Put,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import {
  CreateTenantBranchDTO,
  UpdateTenantBranchDTO,
} from '../dtos/TenantDTOs';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { Roles } from '@shared/infrastructure/auth/decorators/roles.decorator';
import { TenantGuard } from '@shared/infrastructure/auth/guards/TenantGuard';
import { TenantParam } from '@shared/infrastructure/auth/decorators/tenant-param.decorator';
import { CreateTenantBranchUseCase } from '../../application/use-cases/CreateTenantBranchUseCase';
import { UpdateTenantBranchUseCase } from '../../application/use-cases/UpdateTenantBranchUseCase';
import { DeleteTenantBranchUseCase } from '../../application/use-cases/DeleteTenantBranchUseCase';

@Controller('tenants')
@TenantParam('id')
export class TenantBranchController {
  constructor(
    private readonly createTenantBranchUseCase: CreateTenantBranchUseCase,
    private readonly updateTenantBranchUseCase: UpdateTenantBranchUseCase,
    private readonly deleteTenantBranchUseCase: DeleteTenantBranchUseCase,
  ) {}

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
