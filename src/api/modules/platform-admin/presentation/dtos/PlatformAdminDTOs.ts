import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class ListPlatformTenantsQueryDto {
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

export class AdjustQuotasBodyDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  messages?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  aiTokens?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  contacts?: number;
}

export class DraftMessageBodyDto {
  @IsIn(['QUOTA_WARNING', 'CUSTOM'])
  intent!: 'QUOTA_WARNING' | 'CUSTOM';

  @IsString()
  @MinLength(8)
  tenantSummary!: string;

  @IsOptional()
  @IsString()
  operatorHint?: string;
}

export class SendManualMessageBodyDto {
  @IsString()
  @MinLength(1)
  text!: string;
}
