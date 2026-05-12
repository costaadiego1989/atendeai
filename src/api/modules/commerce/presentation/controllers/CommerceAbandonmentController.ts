import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { TenantGuard } from '@shared/infrastructure/auth/guards/TenantGuard';
import { Roles } from '@shared/infrastructure/auth/decorators/roles.decorator';
import { UpdateCommerceAbandonmentStateUseCase } from '../../application/use-cases/UpdateCommerceAbandonmentStateUseCase';
import { TriggerCommerceAbandonmentTouchUseCase } from '../../application/use-cases/TriggerCommerceAbandonmentTouchUseCase';
import { GetAbandonmentConfigUseCase } from '../../application/use-cases/GetAbandonmentConfigUseCase';
import { UpdateAbandonmentConfigUseCase } from '../../application/use-cases/UpdateAbandonmentConfigUseCase';
import { GenerateAbandonmentMessageUseCase } from '../../application/use-cases/GenerateAbandonmentMessageUseCase';
import {
  TriggerCommerceAbandonmentTouchDTO,
  UpdateCommerceAbandonmentStateDTO,
  UpdateCommerceAbandonmentConfigDTO,
} from '../dtos/CommerceDTOs';

@Controller('tenants/:tenantId/commerce')
@UseGuards(JwtCookieGuard, RolesGuard, TenantGuard)
export class CommerceAbandonmentController {
  constructor(
    private readonly updateCommerceAbandonmentStateUseCase: UpdateCommerceAbandonmentStateUseCase,
    private readonly triggerCommerceAbandonmentTouchUseCase: TriggerCommerceAbandonmentTouchUseCase,
    private readonly getAbandonmentConfigUseCase: GetAbandonmentConfigUseCase,
    private readonly updateAbandonmentConfigUseCase: UpdateAbandonmentConfigUseCase,
    private readonly generateAbandonmentMessageUseCase: GenerateAbandonmentMessageUseCase,
  ) {}

  @Put('orders/:orderId/abandonment')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async updateAbandonmentState(
    @Param('tenantId') tenantId: string,
    @Param('orderId') orderId: string,
    @Body() body: UpdateCommerceAbandonmentStateDTO,
  ) {
    return this.updateCommerceAbandonmentStateUseCase.execute({
      tenantId,
      orderId,
      paused: body.paused,
      userId: body.userId,
      userName: body.userName,
    });
  }

  @Post('orders/:orderId/abandonment-touch')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async triggerAbandonmentTouch(
    @Param('tenantId') tenantId: string,
    @Param('orderId') orderId: string,
    @Body() body: TriggerCommerceAbandonmentTouchDTO,
  ) {
    return this.triggerCommerceAbandonmentTouchUseCase.execute({
      tenantId,
      orderId,
      interval: body.interval,
      userId: body.userId,
      userName: body.userName,
    });
  }

  @Get('abandonment-config')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async getAbandonmentConfig(@Param('tenantId') tenantId: string) {
    return this.getAbandonmentConfigUseCase.execute(tenantId);
  }

  @Put('abandonment-config')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async updateAbandonmentConfig(
    @Param('tenantId') tenantId: string,
    @Body() body: UpdateCommerceAbandonmentConfigDTO,
  ) {
    return this.updateAbandonmentConfigUseCase.execute(tenantId, body);
  }

  @Post('abandonment-config/generate-message')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async generateAbandonmentMessage(@Param('tenantId') tenantId: string) {
    return this.generateAbandonmentMessageUseCase.execute(tenantId);
  }
}
