import { ForbiddenException } from '@shared/domain/exceptions/DomainExceptions';
import {
  ITenantAgentRuleRepository,
  TenantAgentRule,
} from '../../domain/repositories/ITenantAgentRuleRepository';
import type { GetTenantAgentRuleInput } from '../use-cases/GetTenantAgentRuleUseCase';
import { parseAgentModule } from '../support/agentRuleDraft';

export class GetTenantAgentRuleService {
  constructor(private readonly repository: ITenantAgentRuleRepository) {}

  async get(input: GetTenantAgentRuleInput): Promise<TenantAgentRule | null> {
    if (input.tenantId !== input.requestingUserTenantId) {
      throw new ForbiddenException(
        'You do not have permission to access rules for this tenant',
      );
    }

    const moduleId = parseAgentModule(input.moduleId);

    return this.repository.findByModule(input.tenantId, moduleId, input.branchId);
  }
}
