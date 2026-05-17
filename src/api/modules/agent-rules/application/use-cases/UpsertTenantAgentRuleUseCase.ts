import { TenantAgentRule } from '../../domain/repositories/ITenantAgentRuleRepository';
import { UpsertTenantAgentRuleService } from '../services/UpsertTenantAgentRuleService';
import { IAgentRuleUseCase } from './IAgentRuleUseCase';

export interface UpsertTenantAgentRuleInput {
  tenantId: string;
  moduleId: string;
  branchId?: string | null;
  customPrompt: string;
  isActive?: boolean;
  fallbackToGlobal?: boolean;
  notes?: string;
  requestingUserId: string;
  requestingUserTenantId: string;
  requestingUserName?: string;
}

export type UpsertTenantAgentRuleOutput = TenantAgentRule;

export class UpsertTenantAgentRuleUseCase implements IAgentRuleUseCase<
  UpsertTenantAgentRuleInput,
  UpsertTenantAgentRuleOutput
> {
  constructor(private readonly ruleService: UpsertTenantAgentRuleService) {}

  async execute(
    input: UpsertTenantAgentRuleInput,
  ): Promise<UpsertTenantAgentRuleOutput> {
    return this.ruleService.upsert(input);
  }
}
