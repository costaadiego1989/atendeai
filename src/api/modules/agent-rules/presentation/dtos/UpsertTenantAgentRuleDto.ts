import {
  IsString,
  IsBoolean,
  IsOptional,
  MaxLength,
  MinLength,
} from 'class-validator';
import { MAX_AGENT_RULE_PROMPT_LENGTH } from '../../application/support/agentRuleDraft';

export class UpsertTenantAgentRuleDto {
  @IsString()
  @MinLength(10, {
    message: 'Describe a rule with at least 10 characters to be effective',
  })
  @MaxLength(MAX_AGENT_RULE_PROMPT_LENGTH, {
    message: `The rule is too long (maximum ${MAX_AGENT_RULE_PROMPT_LENGTH} characters)`,
  })
  customPrompt: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  fallbackToGlobal?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(500, {
    message: 'The internal note must have a maximum of 500 characters',
  })
  notes?: string;
}
