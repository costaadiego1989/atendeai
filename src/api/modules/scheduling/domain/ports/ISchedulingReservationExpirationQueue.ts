export interface SchedulingReservationExpirationJob {
  tenantId: string;
  professionalId: string;
  date: string;
  slotId: string;
  runAt: string;
}

export interface ISchedulingReservationExpirationQueue {
  addJob(job: SchedulingReservationExpirationJob): Promise<void>;
}

export const SCHEDULING_RESERVATION_EXPIRATION_QUEUE = Symbol(
  'ISchedulingReservationExpirationQueue',
);
