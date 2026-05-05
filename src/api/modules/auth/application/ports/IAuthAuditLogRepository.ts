export type AuthAuditEventType =
  | 'LOGIN_SUCCEEDED'
  | 'LOGIN_FAILED'
  | 'REFRESH_SUCCEEDED'
  | 'REFRESH_FAILED'
  | 'LOGOUT_SUCCEEDED'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET_COMPLETED'
  | 'FIRST_ACCESS_PASSWORD_CHANGED';

export interface AuthAuditLogInput {
  eventType: AuthAuditEventType;
  userId?: string;
  tenantId?: string;
  email?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface IAuthAuditLogRepository {
  record(input: AuthAuditLogInput): Promise<void>;
}

export const AUTH_AUDIT_LOG_REPOSITORY = Symbol('AUTH_AUDIT_LOG_REPOSITORY');
