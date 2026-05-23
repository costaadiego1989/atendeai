import { Inject, Injectable } from '@nestjs/common';
import { IUseCase } from '@shared/application/IUseCase';
import {
  ITenantAgentRuleRepository,
  TenantAgentRuleHistory,
  TENANT_AGENT_RULE_REPOSITORY,
} from '../../domain/repositories/ITenantAgentRuleRepository';
import { ensureAgentRuleTenantAccess } from '../support/agentRuleTenantAccess';
import { parseAgentModule } from '../support/agentRuleDraft';

export interface ListTenantAgentRuleHistoryInput {
  tenantId: string;
  moduleId: string;
  branchId?: string | null;
  limit?: number;
  requestingUserId: string;
  requestingUserTenantId: string;
}

export type ListTenantAgentRuleHistoryOutput = TenantAgentRuleHistory[];

@Injectable()
export class ListTenantAgentRuleHistoryUseCase implements IUseCase<
  ListTenantAgentRuleHistoryInput,
  ListTenantAgentRuleHistoryOutput
> {
  constructor(
    @Inject(TENANT_AGENT_RULE_REPOSITORY)
    private readonly repository: ITenantAgentRuleRepository,
  ) {}

  async execute(
    input: ListTenantAgentRuleHistoryInput,
  ): Promise<ListTenantAgentRuleHistoryOutput> {
    ensureAgentRuleTenantAccess(input.tenantId, input.requestingUserTenantId);

    const moduleParsed = parseAgentModule(input.moduleId);
    const limit = Math.min(100, Math.max(1, input.limit ?? 25));

    return this.repository.listRecentHistory({
      tenantId: input.tenantId,
      moduleId: moduleParsed,
      branchId: input.branchId ?? null,
      limit,
    });
  }
}
