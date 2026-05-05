export interface SchedulingReminderQueueJob {
  tenantId: string;
  branchId?: string | null;
  professionalId: string;
  date: string;
  slotId: string;
  offsetHours: 24 | 3 | 1;
  runAt: string;
}

export interface ISchedulingReminderQueue {
  addJob(job: SchedulingReminderQueueJob): Promise<void>;
}

export const SCHEDULING_REMINDER_QUEUE = Symbol('SCHEDULING_REMINDER_QUEUE');
