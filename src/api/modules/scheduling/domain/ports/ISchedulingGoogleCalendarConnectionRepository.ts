import { SchedulingGoogleCalendarConnection } from '../types/SchedulingGoogleCalendarConnection';

export interface ISchedulingGoogleCalendarConnectionRepository {
  save(connection: SchedulingGoogleCalendarConnection): Promise<void>;
  findByScope(
    tenantId: string,
    branchId?: string | null,
  ): Promise<SchedulingGoogleCalendarConnection | null>;
  findBestForScope(
    tenantId: string,
    branchId?: string | null,
  ): Promise<SchedulingGoogleCalendarConnection | null>;
  deleteByScope(tenantId: string, branchId?: string | null): Promise<void>;
}

export const SCHEDULING_GOOGLE_CALENDAR_CONNECTION_REPOSITORY = Symbol(
  'SCHEDULING_GOOGLE_CALENDAR_CONNECTION_REPOSITORY',
);
