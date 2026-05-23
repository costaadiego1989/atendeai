import { Injectable } from '@nestjs/common';
import { IUseCase } from '@shared/application/IUseCase';
import { TenantAgentRule } from '../../domain/repositories/ITenantAgentRuleRepository';
import { GetTenantAgentRuleService } from '../services/GetTenantAgentRuleService';

export interface GetTenantAgentRuleInput {
  tenantId: string;
  moduleId: string;
  branchId?: string | null;
  requestingUserId: string;
  requestingUserTenantId: string;
}

export type GetTenantAgentRuleOutput = TenantAgentRule | null;

@Injectable()
export class GetTenantAgentRuleUseCase implements IUseCase<
  GetTenantAgentRuleInput,
  GetTenantAgentRuleOutput
> {
  constructor(private readonly ruleService: GetTenantAgentRuleService) {}

  async execute(
    input: GetTenantAgentRuleInput,
  ): Promise<GetTenantAgentRuleOutput> {
    return this.ruleService.get(input);
  }
}
