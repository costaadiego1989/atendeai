import { IsString, IsBoolean, IsOptional, MaxLength, MinLength } from 'class-validator';

export class UpsertTenantAgentRuleDto {
  @IsString()
  @MinLength(10, { message: 'Describe a rule with at least 10 characters to be effective' })
  @MaxLength(500, { message: 'The rule is too long (maximum 500 characters)' })
  customPrompt: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  fallbackToGlobal?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'The internal note must have a maximum of 500 characters' })
  notes?: string;
}
