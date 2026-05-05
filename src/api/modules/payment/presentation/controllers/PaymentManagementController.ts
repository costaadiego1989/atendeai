import {
  Body,
  Controller,
  Get,
  Param,
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
  async getTenantAccountStatus(
    @Param('tenantId') tenantId: string,
    @Req() req: any,
  ) {
    return this.getTenantFinancialAccountStatusUseCase.execute(
      req.user?.tenantId || tenantId,
    );
  }

  @Post('account/bootstrap')
  @Roles('OWNER', 'ADMIN')
  async bootstrapTenantAccount(
    @Param('tenantId') tenantId: string,
    @Req() req: any,
    @Body() body: BootstrapTenantFinancialAccountDTO,
  ) {
    return this.bootstrapTenantFinancialAccountUseCase.execute({
      tenantId: req.user?.tenantId || tenantId,
      companyType: body.companyType,
      addressNumber: body.addressNumber,
      complement: body.complement,
      birthDate: body.birthDate,
    });
  }
}
