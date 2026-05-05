export interface ProspectSearchQueueJob {
  searchId: string;
}

export interface IProspectSearchQueue {
  addJob(job: ProspectSearchQueueJob): Promise<void>;
}

export const PROSPECT_SEARCH_QUEUE = Symbol('IProspectSearchQueue');
