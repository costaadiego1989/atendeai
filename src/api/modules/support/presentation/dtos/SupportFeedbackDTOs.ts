import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { SupportFeedbackType } from '../../domain/types/SupportFeedback';

export class CreateSupportFeedbackDTO {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsIn(['BUG', 'SUGGESTION', 'IMPROVEMENT'])
  type!: SupportFeedbackType;

  @IsString()
  @MaxLength(120)
  title!: string;

  @IsString()
  @MaxLength(4000)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  pagePath?: string;

  @IsOptional()
  @ValidateIf(
    (_o: object, value: unknown) =>
      typeof value === 'string' && value.trim().length > 0,
  )
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z0-9_]+$/, {
    message:
      'appModule deve ser snake_case minúsculo (ex.: messaging, catalog).',
  })
  appModule?: string;
}
