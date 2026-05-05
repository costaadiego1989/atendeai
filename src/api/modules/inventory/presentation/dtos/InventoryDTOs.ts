import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

const INVENTORY_AVAILABILITY_STATUSES = [
  'AVAILABLE',
  'LOW_STOCK',
  'UNAVAILABLE',
  'RESERVED',
] as const;

const INVENTORY_SOURCES = [
  'MANUAL_SNAPSHOT',
  'CSV_IMPORT',
  'IMPORT_SNAPSHOT',
  'ERP_SYNC',
  'PDV_SYNC',
  'ECOMMERCE_SYNC',
] as const;

export class SyncInventoryItemDTO {
  @IsOptional()
  @IsString()
  catalogItemId?: string;

  @IsString()
  sku!: string;

  @IsOptional()
  @IsString()
  externalReference?: string;

  @IsString()
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  availableQuantity!: number;

  @IsIn(INVENTORY_AVAILABILITY_STATUSES)
  availabilityStatus!: (typeof INVENTORY_AVAILABILITY_STATUSES)[number];

  @IsOptional()
  @Transform(({ value }) => (value == null ? undefined : String(value)))
  @Matches(/^\d+(\.\d{1,2})?$/)
  currentPrice?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsIn(INVENTORY_SOURCES)
  source?: (typeof INVENTORY_SOURCES)[number];
}

export class CreateInventoryConnectionDTO {
  @IsIn(INVENTORY_SOURCES)
  sourceType!: (typeof INVENTORY_SOURCES)[number];

  @IsString()
  providerName!: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class GenerateInventoryReportDTO {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  availableOnly?: boolean;

  @IsOptional()
  @IsArray()
  @IsIn(INVENTORY_AVAILABILITY_STATUSES, { each: true })
  statuses?: Array<(typeof INVENTORY_AVAILABILITY_STATUSES)[number]>;
}
