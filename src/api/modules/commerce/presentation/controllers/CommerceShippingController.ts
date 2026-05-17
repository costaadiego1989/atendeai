import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { TenantGuard } from '@shared/infrastructure/auth/guards/TenantGuard';
import { Roles } from '@shared/infrastructure/auth/decorators/roles.decorator';
import { ConfigureShippingPolicyUseCase } from '../../application/use-cases/ConfigureShippingPolicyUseCase';
import { GetShippingPolicyUseCase } from '../../application/use-cases/GetShippingPolicyUseCase';
import { ConfigureCommerceShippingPolicyDTO } from '../dtos/CommerceDTOs';

@Controller('tenants/:tenantId/commerce')
@UseGuards(JwtCookieGuard, RolesGuard, TenantGuard)
export class CommerceShippingController {
  constructor(
    private readonly configureShippingPolicyUseCase: ConfigureShippingPolicyUseCase,
    private readonly getShippingPolicyUseCase: GetShippingPolicyUseCase,
  ) {}

  @Get('shipping-policy')
  @Roles('OWNER', 'ADMIN')
  async getShippingPolicy(@Param('tenantId') tenantId: string) {
    return this.getShippingPolicyUseCase.execute(tenantId);
  }

  @Put('shipping-policy')
  @Roles('OWNER', 'ADMIN')
  async configureShippingPolicy(
    @Param('tenantId') tenantId: string,
    @Body() body: ConfigureCommerceShippingPolicyDTO,
  ) {
    return this.configureShippingPolicyUseCase.execute({
      tenantId,
      mode: body.mode,
      fixedAmount: body.fixedAmount,
      pricePerKm: body.pricePerKm,
      minimumAmount: body.minimumAmount,
      maxRadiusKm: body.maxRadiusKm,
      servicedNeighborhoods: body.servicedNeighborhoods,
      deliverySchedule: body.deliverySchedule?.map((slot) => ({
        weekday: slot.weekday,
        enabled: slot.enabled,
        startTime: slot.startTime ?? null,
        endTime: slot.endTime ?? null,
      })),
      notes: body.notes,
      active: true,
    });
  }
}
