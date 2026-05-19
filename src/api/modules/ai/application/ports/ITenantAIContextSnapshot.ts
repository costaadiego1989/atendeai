export interface SchedulingCategoryInfo {
  id: string;
  name: string;
  durationMinutes: number | null;
  basePrice: number | null;
  unit: string | null;
}

export interface TenantAIContextSnapshot {
  tenantId: string;
  generatedAt: Date;
  schedulingCategories: SchedulingCategoryInfo[];
  commerceCatalogItemCount: number;
}

export interface ITenantAIContextSnapshotStore {
  get(tenantId: string): Promise<TenantAIContextSnapshot | null>;
  set(tenantId: string, snapshot: TenantAIContextSnapshot): Promise<void>;
  delete(tenantId: string): Promise<void>;
}

export const TENANT_AI_CONTEXT_SNAPSHOT_STORE = Symbol(
  'TENANT_AI_CONTEXT_SNAPSHOT_STORE',
);
