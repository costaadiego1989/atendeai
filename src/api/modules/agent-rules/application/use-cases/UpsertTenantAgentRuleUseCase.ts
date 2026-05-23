import { Injectable } from '@nestjs/common';
import { IUseCase } from '@shared/application/IUseCase';
import { TenantAgentRule } from '../../domain/repositories/ITenantAgentRuleRepository';
import { UpsertTenantAgentRuleService } from '../services/UpsertTenantAgentRuleService';

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

@Injectable()
export class UpsertTenantAgentRuleUseCase implements IUseCase<
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
