import { TenantAgentRule } from '../../domain/repositories/ITenantAgentRuleRepository';
import { GetTenantAgentRuleService } from '../services/GetTenantAgentRuleService';
import { IAgentRuleUseCase } from './IAgentRuleUseCase';

export interface GetTenantAgentRuleInput {
  tenantId: string;
  moduleId: string;
  branchId?: string | null;
  requestingUserId: string;
  requestingUserTenantId: string;
}

export type GetTenantAgentRuleOutput = TenantAgentRule | null;

export class GetTenantAgentRuleUseCase
  implements IAgentRuleUseCase<GetTenantAgentRuleInput, GetTenantAgentRuleOutput>
{
  constructor(private readonly ruleService: GetTenantAgentRuleService) {}

  async execute(input: GetTenantAgentRuleInput): Promise<GetTenantAgentRuleOutput> {
    return this.ruleService.get(input);
  }
}
