import { Inject, Injectable } from '@nestjs/common';
import { AgentModule } from '../../domain/enums/AgentModule';
import {
  ITenantAgentRuleRepository,
  TenantAgentRule,
  TENANT_AGENT_RULE_REPOSITORY,
} from '../../domain/repositories/ITenantAgentRuleRepository';
import type { UpsertTenantAgentRuleInput } from '../use-cases/UpsertTenantAgentRuleUseCase';
import { ensureAgentRuleTenantAccess } from '../support/agentRuleTenantAccess';
import {
  normalizeAgentPrompt,
  parseAgentModule,
} from '../support/agentRuleDraft';

@Injectable()
export class UpsertTenantAgentRuleService {
  constructor(
    @Inject(TENANT_AGENT_RULE_REPOSITORY)
    private readonly repository: ITenantAgentRuleRepository,
  ) {}

  async upsert(input: UpsertTenantAgentRuleInput): Promise<TenantAgentRule> {
    ensureAgentRuleTenantAccess(input.tenantId, input.requestingUserTenantId);

    const moduleId = parseAgentModule(input.moduleId);
    const customPrompt = normalizeAgentPrompt(input.customPrompt);
    const existingRule = await this.repository.findExactByScope(
      input.tenantId,
      moduleId,
      input.branchId,
    );
    const rule = this.buildRule(input, moduleId, customPrompt, existingRule);

    await this.repository.save(rule);
    await this.repository.saveHistory({
      tenantId: rule.tenantId,
      branchId: rule.branchId ?? null,
      moduleId: rule.moduleId,
      customPrompt: rule.customPrompt,
      revision: rule.revision,
      createdAt: new Date(),
      updatedByUserId: rule.updatedByUserId,
      updatedByUserName: rule.updatedByUserName,
    });

    return rule;
  }

  private buildRule(
    input: UpsertTenantAgentRuleInput,
    moduleId: AgentModule,
    customPrompt: string,
    existingRule: TenantAgentRule | null,
  ): TenantAgentRule {
    return {
      tenantId: input.tenantId,
      branchId: input.branchId ?? null,
      moduleId,
      customPrompt,
      isActive: input.isActive !== false,
      fallbackToGlobal: input.fallbackToGlobal !== false,
      revision: (existingRule?.revision ?? 0) + 1,
      notes: input.notes?.trim() || null,
      updatedByUserId: input.requestingUserId,
      updatedByUserName: input.requestingUserName || 'Unknown',
    };
  }
}
