export class TenantAgentRuleHistoryEntryDto {
  tenantId: string;
  branchId?: string | null;
  moduleId: string;
  customPrompt: string;
  revision: number;
  createdAt: Date;
  updatedByUserId?: string | null;
  updatedByUserName?: string | null;
}
