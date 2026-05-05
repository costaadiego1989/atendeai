import { Body, Controller, Get, Inject, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { TenantGuard } from '@shared/infrastructure/auth/guards/TenantGuard';
import {
  ChangeSubscriptionPlanDTO,
  ReplaceSubscriptionModulesDTO,
} from '../dtos/SubscriptionDTOs';
import {
  IChangeSubscriptionPlanUseCase,
} from '../../application/use-cases/interfaces/IChangeSubscriptionPlanUseCase';
import { ICancelSubscriptionUseCase } from '../../application/use-cases/interfaces/ICancelSubscriptionUseCase';
import { IListBillingPlansUseCase } from '../../application/use-cases/interfaces/IListBillingPlansUseCase';
import { IGetSubscriptionCatalogUseCase } from '../../application/use-cases/interfaces/IGetSubscriptionCatalogUseCase';
import { IReplaceSubscriptionModulesUseCase } from '../../application/use-cases/interfaces/IReplaceSubscriptionModulesUseCase';

@Controller('tenants/:tenantId/subscription')
@UseGuards(JwtCookieGuard, TenantGuard)
export class SubscriptionController {
  constructor(
    @Inject(IChangeSubscriptionPlanUseCase)
    private readonly changeSubscriptionPlanUseCase: IChangeSubscriptionPlanUseCase,
    @Inject(ICancelSubscriptionUseCase)
    private readonly cancelSubscriptionUseCase: ICancelSubscriptionUseCase,
    @Inject(IListBillingPlansUseCase)
    private readonly listBillingPlansUseCase: IListBillingPlansUseCase,
    @Inject(IGetSubscriptionCatalogUseCase)
    private readonly getSubscriptionCatalogUseCase: IGetSubscriptionCatalogUseCase,
    @Inject(IReplaceSubscriptionModulesUseCase)
    private readonly replaceSubscriptionModulesUseCase: IReplaceSubscriptionModulesUseCase,
  ) {}

  @Get('plans')
  async listPlans(@Param('tenantId') tenantId: string) {
    return this.listBillingPlansUseCase.execute({ tenantId });
  }

  @Get('catalog')
  async getCatalog(@Param('tenantId') tenantId: string) {
    return this.getSubscriptionCatalogUseCase.execute({ tenantId });
  }

  @Patch('plan')
  async changePlan(
    @Param('tenantId') tenantId: string,
    @Body() body: ChangeSubscriptionPlanDTO,
  ) {
    return this.changeSubscriptionPlanUseCase.execute({
      tenantId,
      targetPlan: body.targetPlan,
    });
  }

  @Put('modules')
  async replaceModules(
    @Param('tenantId') tenantId: string,
    @Body() body: ReplaceSubscriptionModulesDTO,
  ) {
    return this.replaceSubscriptionModulesUseCase.execute({
      tenantId,
      moduleCodes: body.moduleCodes ?? [],
    });
  }

  @Post('cancel')
  async cancel(@Param('tenantId') tenantId: string) {
    return this.cancelSubscriptionUseCase.execute({ tenantId });
  }
}
