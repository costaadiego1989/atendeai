import { AgentModule } from '../enums/AgentModule';

export interface TenantAgentRule {
  tenantId: string;
  branchId?: string | null;
  moduleId: AgentModule;
  customPrompt: string;
  isActive: boolean;
  fallbackToGlobal: boolean;
  revision: number;
  notes?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  updatedByUserId?: string | null;
  updatedByUserName?: string | null;
  inheritedFromTenant?: boolean;
}

export interface TenantAgentRuleHistory {
  tenantId: string;
  branchId?: string | null;
  moduleId: AgentModule;
  customPrompt: string;
  revision: number;
  createdAt: Date;
  updatedByUserId?: string | null;
  updatedByUserName?: string | null;
}

export interface ITenantAgentRuleRepository {
  findByModule(
    tenantId: string,
    moduleId: AgentModule,
    branchId?: string | null,
  ): Promise<TenantAgentRule | null>;
  findExactByScope(
    tenantId: string,
    moduleId: AgentModule,
    branchId?: string | null,
  ): Promise<TenantAgentRule | null>;
  save(rule: TenantAgentRule): Promise<void>;
  saveHistory(history: TenantAgentRuleHistory): Promise<void>;
  listRecentHistory(params: {
    tenantId: string;
    moduleId: AgentModule;
    branchId?: string | null;
    limit: number;
  }): Promise<TenantAgentRuleHistory[]>;
}

export const TENANT_AGENT_RULE_REPOSITORY = Symbol('TENANT_AGENT_RULE_REPOSITORY');
