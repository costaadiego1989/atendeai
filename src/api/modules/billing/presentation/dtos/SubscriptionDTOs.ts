import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class ChangeSubscriptionPlanDTO {
  @IsString()
  @IsNotEmpty()
  @IsIn(['ESSENCIAL', 'PROFISSIONAL', 'ESCALA'])
  targetPlan: 'ESSENCIAL' | 'PROFISSIONAL' | 'ESCALA';

  @IsOptional()
  @IsString()
  @IsIn(['MONTHLY', 'YEARLY'])
  billingCycle?: 'MONTHLY' | 'YEARLY';
}

export class ReplaceSubscriptionModulesDTO {
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  moduleCodes?: string[];
}
