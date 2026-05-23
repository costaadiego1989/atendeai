import { Injectable } from '@nestjs/common';
import { GetTenantAgentRuleUseCase } from '../use-cases/GetTenantAgentRuleUseCase';
import { UpsertTenantAgentRuleUseCase } from '../use-cases/UpsertTenantAgentRuleUseCase';
import { TenantAgentRuleResponseDto } from '../../presentation/dtos/TenantAgentRuleResponseDto';
import { traceAsync } from '@shared/infrastructure/observability/DomainTrace';

@Injectable()
export class TenantAgentRuleService {
  constructor(
    private readonly getRuleUseCase: GetTenantAgentRuleUseCase,
    private readonly upsertRuleUseCase: UpsertTenantAgentRuleUseCase,
  ) {}

  private traceAttrs(params: {
    tenantId: string;
    moduleId: string;
    branchId?: string | null;
    operation: string;
  }): Record<string, string> {
    return {
      'tenant.id': params.tenantId,
      'agent.module': params.moduleId,
      'agent.branch_id': params.branchId ?? '',
      'agent.operation': params.operation,
    };
  }

  async getRule(
    tenantId: string,
    moduleId: string,
    requestingUserId: string = 'SYSTEM',
    requestingUserTenantId: string = tenantId,
    branchId?: string | null,
  ): Promise<TenantAgentRuleResponseDto | null> {
    return traceAsync(
      'agent-rules.TenantAgentRuleService.getRule',
      this.traceAttrs({
        tenantId,
        moduleId,
        branchId,
        operation: 'read',
      }),
      async () =>
        this.getRuleUseCase.execute({
          tenantId,
          moduleId,
          branchId,
          requestingUserId,
          requestingUserTenantId,
        }),
    );
  }

  async setRule(
    tenantId: string,
    moduleId: string,
    customPrompt: string,
    isActive: boolean = true,
    requestingUserId: string = 'SYSTEM',
    requestingUserTenantId: string = tenantId,
    branchId?: string | null,
  ): Promise<TenantAgentRuleResponseDto> {
    return traceAsync(
      'agent-rules.TenantAgentRuleService.setRule',
      this.traceAttrs({
        tenantId,
        moduleId,
        branchId,
        operation: 'write',
      }),
      async () =>
        this.upsertRuleUseCase.execute({
          tenantId,
          moduleId,
          branchId,
          customPrompt,
          isActive,
          requestingUserId,
          requestingUserTenantId,
        }),
    );
  }
}
