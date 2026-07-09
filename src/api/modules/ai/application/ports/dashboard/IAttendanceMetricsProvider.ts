export interface AttendanceMetrics {
  activeConversations: number;
  inQueue: number;
  waitingHuman: number;
  avgResponseTimeSeconds: number;
  avgAiResponseTimeSeconds: number;
  byChannel: Array<{ channel: string; count: number }>;
  byAgent?: Array<{ agentName: string; activeCount: number }>;
}

export interface IAttendanceMetricsProvider {
  getStatus(tenantId: string): Promise<AttendanceMetrics>;
}

export const ATTENDANCE_METRICS_PROVIDER = Symbol('ATTENDANCE_METRICS_PROVIDER');
