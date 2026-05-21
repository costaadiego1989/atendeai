import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsObject,
  IsArray,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { TenantGuard } from '@shared/infrastructure/auth/guards/TenantGuard';
import { Roles } from '@shared/infrastructure/auth/decorators/roles.decorator';
import { GetVoiceConfigUseCase } from '../../application/use-cases/GetVoiceConfigUseCase';
import { UpdateVoiceConfigUseCase } from '../../application/use-cases/UpdateVoiceConfigUseCase';
import { ListVoiceCallsUseCase } from '../../application/use-cases/ListVoiceCallsUseCase';

class UpdateVoiceConfigDTO {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsObject() persona?: Record<string, unknown>;
  @IsOptional() @IsObject() allowedHours?: Record<string, unknown>;
  @IsOptional() @IsObject() recovery?: Record<string, unknown>;
  @IsOptional() @IsArray() scripts?: unknown[];
  @IsOptional() twilioPhoneNumber?: string | null;
}

class ListCallsQueryDTO {
  @IsOptional() @IsNumber() @Min(1) @Type(() => Number) page?: number;
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
  @IsOptional() @IsString() status?: string;
}

@Controller('tenants/:tenantId/voice')
@UseGuards(JwtCookieGuard, RolesGuard, TenantGuard)
@Roles('OWNER', 'ADMIN')
export class VoiceConfigController {
  constructor(
    private readonly getConfig: GetVoiceConfigUseCase,
    private readonly updateConfig: UpdateVoiceConfigUseCase,
    private readonly listCalls: ListVoiceCallsUseCase,
  ) {}

  @Get('config')
  async getVoiceConfig(@Param('tenantId') tenantId: string) {
    return this.getConfig.execute(tenantId);
  }

  @Put('config')
  async updateVoiceConfig(
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateVoiceConfigDTO,
  ) {
    return this.updateConfig.execute(tenantId, dto);
  }

  @Get('calls')
  async getVoiceCalls(
    @Param('tenantId') tenantId: string,
    @Query() query: ListCallsQueryDTO,
  ) {
    return this.listCalls.execute({
      tenantId,
      page: query.page,
      limit: query.limit,
      status: query.status,
    });
  }

  @Get('metrics')
  async getVoiceMetrics(@Param('tenantId') _tenantId: string) {
    return {
      totalCalls: 0,
      answeredRate: 0,
      agreementRate: 0,
      totalRecovered: 0,
      avgDuration: 0,
      callsByResult: {},
    };
  }
}
