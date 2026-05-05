export type SchedulingGoogleCalendarConnectionStatus = 'CONNECTED';

export interface SchedulingGoogleCalendarConnection {
  tenantId: string;
  branchId?: string | null;
  googleEmail?: string;
  refreshToken: string;
  calendarId: string;
  status: SchedulingGoogleCalendarConnectionStatus;
  connectedAt: string;
  updatedAt: string;
}
