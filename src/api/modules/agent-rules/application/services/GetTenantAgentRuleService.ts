import { Inject, Injectable } from '@nestjs/common';
import { ForbiddenException } from '@shared/domain/exceptions/DomainExceptions';
import {
  ITenantAgentRuleRepository,
  TenantAgentRule,
  TENANT_AGENT_RULE_REPOSITORY,
} from '../../domain/repositories/ITenantAgentRuleRepository';
import type { GetTenantAgentRuleInput } from '../use-cases/GetTenantAgentRuleUseCase';
import { parseAgentModule } from '../support/agentRuleDraft';

@Injectable()
export class GetTenantAgentRuleService {
  constructor(
    @Inject(TENANT_AGENT_RULE_REPOSITORY)
    private readonly repository: ITenantAgentRuleRepository,
  ) {}

  async get(input: GetTenantAgentRuleInput): Promise<TenantAgentRule | null> {
    if (input.tenantId !== input.requestingUserTenantId) {
      throw new ForbiddenException(
        'You do not have permission to access rules for this tenant',
      );
    }

    const moduleId = parseAgentModule(input.moduleId);

    return this.repository.findByModule(
      input.tenantId,
      moduleId,
      input.branchId,
    );
  }
}
