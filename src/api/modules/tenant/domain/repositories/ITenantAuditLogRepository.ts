export type TenantAuditEventType =
  | 'BUSINESS_DATA_UPDATED'
  | 'AI_CONFIG_UPDATED'
  | 'WHATSAPP_CONFIGURED'
  | 'INSTAGRAM_CONFIGURED'
  | 'BRANCH_ADDED'
  | 'BRANCH_UPDATED'
  | 'BRANCH_DELETED'
  | 'PROMOTION_ADDED'
  | 'PROMOTION_UPDATED'
  | 'PROMOTION_DELETED';

export interface TenantAuditLogInput {
  tenantId: string;
  eventType: TenantAuditEventType;
  userId?: string;
  email?: string;
  metadata?: Record<string, unknown>;
}

export interface TenantAuditLogEntry {
  id: string;
  tenantId: string;
  userId?: string | null;
  email?: string | null;
  eventType: TenantAuditEventType;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface ITenantAuditLogRepository {
  record(input: TenantAuditLogInput): Promise<void>;
  listRecent(tenantId: string, limit?: number): Promise<TenantAuditLogEntry[]>;
}

export const TENANT_AUDIT_LOG_REPOSITORY = Symbol(
  'TENANT_AUDIT_LOG_REPOSITORY',
);
