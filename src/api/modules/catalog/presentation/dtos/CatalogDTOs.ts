import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

const CATALOG_ITEM_TYPES = ['SERVICE', 'PRODUCT', 'RENTAL'] as const;
const CATALOG_ITEM_SOURCES = ['MANUAL', 'IMPORT', 'ERP_SNAPSHOT'] as const;

export class CreateCatalogCategoryDTO {
  @IsOptional()
  @IsString()
  parentCategoryId?: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateCatalogCategoryDTO {
  @IsOptional()
  @IsString()
  parentCategoryId?: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateCatalogItemDTO {
  @IsIn(CATALOG_ITEM_TYPES)
  type!: (typeof CATALOG_ITEM_TYPES)[number];

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Transform(({ value }) => (value == null ? undefined : String(value)))
  @Matches(/^\d+(\.\d{1,2})?$/)
  basePrice?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsIn(CATALOG_ITEM_SOURCES)
  source?: (typeof CATALOG_ITEM_SOURCES)[number];

  @IsOptional()
  @IsString()
  externalReference?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value == null ? undefined : Number(value),
  )
  @IsInt()
  @Min(0)
  initialStock?: number;

  @IsOptional()
  @Transform(({ value }) => (value == null ? undefined : Number(value)))
  @IsInt()
  @Min(0)
  weightGrams?: number;

  @IsOptional()
  @Transform(({ value }) => (value == null ? undefined : Number(value)))
  @IsInt()
  @Min(0)
  heightCm?: number;

  @IsOptional()
  @Transform(({ value }) => (value == null ? undefined : Number(value)))
  @IsInt()
  @Min(0)
  widthCm?: number;

  @IsOptional()
  @Transform(({ value }) => (value == null ? undefined : Number(value)))
  @IsInt()
  @Min(0)
  lengthCm?: number;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  variants?: Array<Record<string, unknown>>;

  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  optionGroups?: Array<Record<string, unknown>>;
}

export class UpdateCatalogItemDTO {
  @IsIn(CATALOG_ITEM_TYPES)
  type!: (typeof CATALOG_ITEM_TYPES)[number];

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Transform(({ value }) => (value == null ? undefined : String(value)))
  @Matches(/^\d+(\.\d{1,2})?$/)
  basePrice?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  externalReference?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @Transform(({ value }) => (value == null ? undefined : Number(value)))
  @IsInt()
  @Min(0)
  weightGrams?: number;

  @IsOptional()
  @Transform(({ value }) => (value == null ? undefined : Number(value)))
  @IsInt()
  @Min(0)
  heightCm?: number;

  @IsOptional()
  @Transform(({ value }) => (value == null ? undefined : Number(value)))
  @IsInt()
  @Min(0)
  widthCm?: number;

  @IsOptional()
  @Transform(({ value }) => (value == null ? undefined : Number(value)))
  @IsInt()
  @Min(0)
  lengthCm?: number;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  variants?: Array<Record<string, unknown>>;

  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  optionGroups?: Array<Record<string, unknown>>;
}

export class GenerateCatalogReportDTO {
  @IsOptional()
  @IsArray()
  @IsIn(CATALOG_ITEM_TYPES, { each: true })
  types?: Array<(typeof CATALOG_ITEM_TYPES)[number]>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeInactive?: boolean;
}

export class ImportCatalogItemsDTO {
  @IsString()
  rawText!: string;

  @IsOptional()
  @IsIn(CATALOG_ITEM_TYPES)
  defaultType?: (typeof CATALOG_ITEM_TYPES)[number];

  @IsOptional()
  @IsString()
  defaultCategoryName?: string;

  @IsOptional()
  @IsIn(CATALOG_ITEM_SOURCES)
  defaultSource?: (typeof CATALOG_ITEM_SOURCES)[number];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  defaultTags?: string[];

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  syncInventory?: boolean;
}
