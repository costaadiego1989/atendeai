export interface InboxRecord {
  consumerName: string;
  eventId: string;
  eventType: string;
  queue: string;
  payload: Record<string, unknown>;
}

export interface IInboxStore {
  claim(record: InboxRecord): Promise<string | null>;
  markProcessed(id: string): Promise<void>;
  markFailed(id: string, errorMessage: string): Promise<void>;
}
