import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { TenantGuard } from '@shared/infrastructure/auth/guards/TenantGuard';
import { Roles } from '@shared/infrastructure/auth/decorators/roles.decorator';
import { BootstrapTenantFinancialAccountUseCase } from '../../application/use-cases/BootstrapTenantFinancialAccountUseCase';
import { GetTenantFinancialAccountStatusUseCase } from '../../application/use-cases/GetTenantFinancialAccountStatusUseCase';
import { BootstrapTenantFinancialAccountDTO } from '../dtos/PaymentManagementDTOs';

@Controller('tenants/:tenantId/payment')
@UseGuards(JwtCookieGuard, RolesGuard, TenantGuard)
export class PaymentManagementController {
  constructor(
    private readonly bootstrapTenantFinancialAccountUseCase: BootstrapTenantFinancialAccountUseCase,
    private readonly getTenantFinancialAccountStatusUseCase: GetTenantFinancialAccountStatusUseCase,
  ) {}

  @Get('account/status')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async getTenantAccountStatus(@Req() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException('Tenant context required');
    }
    return this.getTenantFinancialAccountStatusUseCase.execute(tenantId);
  }

  @Post('account/bootstrap')
  @Roles('OWNER', 'ADMIN')
  async bootstrapTenantAccount(
    @Req() req: any,
    @Body() body: BootstrapTenantFinancialAccountDTO,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException('Tenant context required');
    }
    return this.bootstrapTenantFinancialAccountUseCase.execute({
      tenantId,
      companyType: body.companyType,
      addressNumber: body.addressNumber,
      complement: body.complement,
      birthDate: body.birthDate,
    });
  }
}
