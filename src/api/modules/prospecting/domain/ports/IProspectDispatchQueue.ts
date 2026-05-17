export interface ProspectDispatchJob {
  tenantId: string;
  campaignId: string;
}

export interface IProspectDispatchQueue {
  scheduleNextDispatch(job: ProspectDispatchJob, delayMs: number): Promise<void>;
}

export const PROSPECT_DISPATCH_QUEUE = Symbol('IProspectDispatchQueue');
