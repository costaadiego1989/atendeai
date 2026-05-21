import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Body,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  IsBoolean,
  IsHexColor,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { TenantGuard } from '@shared/infrastructure/auth/guards/TenantGuard';
import { Roles } from '@shared/infrastructure/auth/decorators/roles.decorator';
import { GetWidgetConfigUseCase } from '../../application/use-cases/GetWidgetConfigUseCase';
import { UpdateWidgetConfigUseCase } from '../../application/use-cases/UpdateWidgetConfigUseCase';
import { UploadWidgetAvatarUseCase } from '../../application/use-cases/UploadWidgetAvatarUseCase';

class UpdateWidgetConfigDTO {
  @IsOptional() @IsString() @MaxLength(100) name?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() greeting?: string | null;
  @IsOptional() @IsHexColor() color?: string | null;
  @IsOptional() @IsString() @MaxLength(20) backgroundColor?: string | null;
  @IsOptional() @IsIn(['bottom-right', 'bottom-left']) position?: string;
  @IsOptional() @IsBoolean() collectName?: boolean;
  @IsOptional() @IsBoolean() collectPhone?: boolean;
  @IsOptional() @IsBoolean() collectEmail?: boolean;
  @IsOptional() @IsBoolean() collectCpf?: boolean;
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number) proactiveDelay?:
    | number
    | null;
  @IsOptional() @IsString() proactiveMsg?: string | null;
}

@Controller('tenants/:tenantId/widget-config')
@UseGuards(JwtCookieGuard, RolesGuard, TenantGuard)
@Roles('OWNER', 'ADMIN')
export class WidgetConfigController {
  constructor(
    private readonly getConfig: GetWidgetConfigUseCase,
    private readonly updateConfig: UpdateWidgetConfigUseCase,
    private readonly uploadAvatar: UploadWidgetAvatarUseCase,
  ) {}

  @Get()
  async get(@Param('tenantId') tenantId: string) {
    return this.getConfig.execute(tenantId);
  }

  @Put()
  async update(
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateWidgetConfigDTO,
  ) {
    return this.updateConfig.execute(tenantId, dto);
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  async avatar(
    @Param('tenantId') tenantId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.uploadAvatar.execute(tenantId, file.buffer, file.mimetype);
  }
}
