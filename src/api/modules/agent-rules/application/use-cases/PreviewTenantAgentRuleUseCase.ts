import { Inject, Injectable } from '@nestjs/common';
import { IUseCase } from '@shared/application/IUseCase';
import {
  ITenantAgentRuleRepository,
  TENANT_AGENT_RULE_REPOSITORY,
} from '../../domain/repositories/ITenantAgentRuleRepository';
import { ensureAgentRuleTenantAccess } from '../support/agentRuleTenantAccess';
import {
  normalizeAgentPrompt,
  parseAgentModule,
} from '../support/agentRuleDraft';

export interface PreviewTenantAgentRuleInput {
  tenantId: string;
  moduleId: string;
  branchId?: string | null;
  customPrompt: string;
  isActive?: boolean;
  fallbackToGlobal?: boolean;
  notes?: string;
  requestingUserId: string;
  requestingUserTenantId: string;
}

export interface PreviewTenantAgentRuleOutput {
  moduleId: string;
  branchId: string | null;
  normalizedCustomPrompt: string;
  currentStoredRevision: number;
  wouldBeRevision: number;
  isActive: boolean;
  fallbackToGlobal: boolean;
  notesTrimmed: string | null;
}

@Injectable()
export class PreviewTenantAgentRuleUseCase implements IUseCase<
  PreviewTenantAgentRuleInput,
  PreviewTenantAgentRuleOutput
> {
  constructor(
    @Inject(TENANT_AGENT_RULE_REPOSITORY)
    private readonly repository: ITenantAgentRuleRepository,
  ) {}

  async execute(
    input: PreviewTenantAgentRuleInput,
  ): Promise<PreviewTenantAgentRuleOutput> {
    ensureAgentRuleTenantAccess(input.tenantId, input.requestingUserTenantId);

    const moduleParsed = parseAgentModule(input.moduleId);
    const normalizedCustomPrompt = normalizeAgentPrompt(input.customPrompt);
    const existing = await this.repository.findExactByScope(
      input.tenantId,
      moduleParsed,
      input.branchId,
    );

    const currentStoredRevision = existing?.revision ?? 0;

    return {
      moduleId: moduleParsed,
      branchId: input.branchId ?? null,
      normalizedCustomPrompt,
      currentStoredRevision,
      wouldBeRevision: currentStoredRevision + 1,
      isActive: input.isActive !== false,
      fallbackToGlobal: input.fallbackToGlobal !== false,
      notesTrimmed: input.notes?.trim() || null,
    };
  }
}
