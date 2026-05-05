import {
  Controller,
  Get,
  Header,
  Param,
  Inject,
  UseGuards,
} from '@nestjs/common';
import { IGetUsageUseCase } from '../../application/use-cases/interfaces/IGetUsageUseCase';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { TenantGuard } from '@shared/infrastructure/auth/guards/TenantGuard';
import { buildUsageExportCsv } from '../helpers/buildUsageExportCsv';
import { SkipSuccessEnvelope } from '@shared/infrastructure/http/decorators/skip-success-envelope.decorator';

@Controller('tenants/:tenantId/usage')
@UseGuards(JwtCookieGuard, TenantGuard)
export class UsageController {
  constructor(
    @Inject(IGetUsageUseCase)
    private readonly getUsageUseCase: IGetUsageUseCase,
  ) {}

  @Get('export.csv')
  @SkipSuccessEnvelope()
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="usage-periodo-atual.csv"',
  )
  async exportUsageCsv(@Param('tenantId') tenantId: string) {
    const data = await this.getUsageUseCase.execute({ tenantId });
    return buildUsageExportCsv(data);
  }

  @Get()
  async getUsage(@Param('tenantId') tenantId: string) {
    return this.getUsageUseCase.execute({ tenantId });
  }
}
