import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { ApiKeyGuard } from '../../../../shared/infrastructure/guards/ApiKeyGuard';
import {
  CreateExternalTenantUseCase,
  CreateExternalTenantInput,
} from '../../application/use-cases/CreateExternalTenantUseCase';
import { Tenant } from '../../domain/entities/Tenant';

interface RequestWithTenant extends Request {
  tenant: Tenant;
}

@Controller('tenant/external')
export class IntegrationController {
  constructor(
    private readonly createExternalTenantUseCase: CreateExternalTenantUseCase,
  ) {}

  @Get('config')
  @UseGuards(ApiKeyGuard)
  async getStoreConfig(@Req() req: RequestWithTenant) {
    const tenant = req.tenant;
    return {
      companyName: tenant.companyName.value,
      businessType: tenant.businessType,
      description: tenant.description,
      promotions: tenant.promotions.map((p) => ({
        title: p.title,
        description: p.description,
        value: p.value,
        imageUrl: p.imageUrl,
      })),
      operatingHours: tenant.operatingHours,
      catalogUrl: tenant.catalogUrl,
    };
  }

  @Post('subscribe')
  async subscribeStore(@Body() data: CreateExternalTenantInput) {
    const result = await this.createExternalTenantUseCase.execute(data);

    return {
      success: true,
      apiKey: result.apiKey,
      message: 'Store subscription successful',
      instructions:
        'Use your API Key in the X-API-KEY header for all integration requests.',
    };
  }
}
