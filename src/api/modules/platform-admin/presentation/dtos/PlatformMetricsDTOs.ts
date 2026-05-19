import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class PlatformMetricsQueryDto {
  @IsOptional()
  @IsIn(['1d', '7d', '30d', '90d', 'custom'])
  period?: '1d' | '7d' | '30d' | '90d' | 'custom' = '30d';

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsIn(['TRIAL', 'STARTER', 'PRO', 'ENTERPRISE'])
  plan?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'SUSPENDED', 'CANCELLED'])
  planStatus?: string;
}

export class PlatformPaginatedQueryDto extends PlatformMetricsQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class PlatformMessagingQueryDto extends PlatformPaginatedQueryDto {
  @IsOptional()
  @IsIn(['WHATSAPP', 'INSTAGRAM'])
  channel?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'CLOSED', 'WAITING'])
  status?: string;

  @IsOptional()
  @IsString()
  contactSearch?: string;
}

export class PlatformSalesQueryDto extends PlatformPaginatedQueryDto {
  @IsOptional()
  @IsIn(['ACTIVE', 'PAID', 'EXPIRED', 'CANCELLED'])
  linkStatus?: string;

  @IsOptional()
  @IsIn(['PIX', 'BOLETO', 'CREDIT_CARD'])
  billingType?: string;
}

export class PlatformBillingQueryDto extends PlatformPaginatedQueryDto {
  @IsOptional()
  @IsIn(['ACTIVE', 'CANCELLED', 'PENDING', 'SUSPENDED'])
  subscriptionStatus?: string;

  @IsOptional()
  @IsIn(['MONTHLY', 'YEARLY'])
  billingCycleType?: string;
}
