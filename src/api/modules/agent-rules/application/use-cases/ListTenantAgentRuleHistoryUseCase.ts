import type {
  ITenantAgentRuleRepository,
  TenantAgentRuleHistory,
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

export class ListTenantAgentRuleHistoryUseCase {
  constructor(private readonly repository: ITenantAgentRuleRepository) {}

  async execute(
    input: ListTenantAgentRuleHistoryInput,
  ): Promise<ListTenantAgentRuleHistoryOutput> {
    ensureAgentRuleTenantAccess(
      input.tenantId,
      input.requestingUserTenantId,
    );

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
