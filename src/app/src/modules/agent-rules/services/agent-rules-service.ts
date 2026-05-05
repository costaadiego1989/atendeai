import { apiClient } from '@/shared/api/client';

export interface TenantAgentRule {
  moduleId: string;
  branchId?: string | null;
  customPrompt: string;
  isActive: boolean;
  fallbackToGlobal: boolean;
  revision: number;
  scope?: 'TENANT' | 'BRANCH';
  inheritedFromTenant?: boolean;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  updatedByUserId?: string | null;
  updatedByUserName?: string | null;
}

export interface TenantAgentRulePreviewOutput {
  moduleId: string;
  branchId: string | null;
  normalizedCustomPrompt: string;
  currentStoredRevision: number;
  wouldBeRevision: number;
  isActive: boolean;
  fallbackToGlobal: boolean;
  notesTrimmed: string | null;
}

export interface TenantAgentRuleHistoryEntry {
  tenantId: string;
  branchId?: string | null;
  moduleId: string;
  customPrompt: string;
  revision: number;
  createdAt: string;
  updatedByUserId?: string | null;
  updatedByUserName?: string | null;
}

function withBranchQuery(path: string, branchId?: string | null): string {
  if (!branchId) {
    return path;
  }

  return `${path}?branchId=${encodeURIComponent(branchId)}`;
}

function withOptionalQuery(path: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      search.set(key, value);
    }
  });

  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

export const agentRulesService = {
  getRule(
    tenantId: string,
    moduleId: string,
    branchId?: string | null,
  ): Promise<TenantAgentRule> {
    return apiClient.get<TenantAgentRule>(
      withBranchQuery(`/tenants/${tenantId}/agent-rules/${moduleId}`, branchId),
    );
  },

  listHistory(
    tenantId: string,
    moduleId: string,
    branchId?: string | null,
    limit = 25,
  ): Promise<TenantAgentRuleHistoryEntry[]> {
    return apiClient.get<TenantAgentRuleHistoryEntry[]>(
      withOptionalQuery(`/tenants/${tenantId}/agent-rules/${moduleId}/history`, {
        ...(branchId ? { branchId } : {}),
        limit: String(limit),
      }),
    );
  },

  previewRule(
    tenantId: string,
    moduleId: string,
    input: {
      customPrompt: string;
      isActive: boolean;
      fallbackToGlobal: boolean;
      notes?: string;
    },
    branchId?: string | null,
  ): Promise<TenantAgentRulePreviewOutput> {
    return apiClient.post<TenantAgentRulePreviewOutput>(
      withBranchQuery(`/tenants/${tenantId}/agent-rules/${moduleId}/preview`, branchId),
      input,
    );
  },

  saveRule(
    tenantId: string,
    moduleId: string,
    input: {
      customPrompt: string;
      isActive: boolean;
      fallbackToGlobal: boolean;
      notes?: string;
    },
    branchId?: string | null,
  ): Promise<TenantAgentRule> {
    return apiClient.put<TenantAgentRule>(
      withBranchQuery(`/tenants/${tenantId}/agent-rules/${moduleId}`, branchId),
      input,
    );
  },
};
