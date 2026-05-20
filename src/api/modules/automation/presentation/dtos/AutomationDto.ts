import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsObject,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TriggerConfigDto {
  @IsString()
  type: string;

  @IsObject()
  config: Record<string, unknown>;
}

export class StepDto {
  @IsString()
  type: string;

  @IsObject()
  config: Record<string, unknown>;

  @IsNumber()
  @IsOptional()
  order?: number;
}

export class CreateAutomationDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @ValidateNested()
  @Type(() => TriggerConfigDto)
  trigger: TriggerConfigDto;

  @IsArray()
  @IsOptional()
  conditions?: Record<string, unknown>[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StepDto)
  steps: StepDto[];
}

export class UpdateAutomationDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @ValidateNested()
  @Type(() => TriggerConfigDto)
  @IsOptional()
  trigger?: TriggerConfigDto;

  @IsArray()
  @IsOptional()
  conditions?: Record<string, unknown>[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StepDto)
  @IsOptional()
  steps?: StepDto[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
