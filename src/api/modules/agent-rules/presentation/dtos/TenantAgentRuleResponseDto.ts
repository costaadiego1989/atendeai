export class TenantAgentRuleResponseDto {
  moduleId: string;
  branchId?: string | null;
  customPrompt: string;
  isActive: boolean;
  fallbackToGlobal: boolean;
  revision: number;
  scope?: 'TENANT' | 'BRANCH';
  inheritedFromTenant?: boolean;
  notes?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  updatedByUserId?: string | null;
  updatedByUserName?: string | null;
}
