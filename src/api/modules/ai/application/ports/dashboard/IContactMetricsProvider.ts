export interface ContactMetrics {
  totalContacts: number;
  newInPeriod: number;
  byFunnelStage: Array<{ stage: string; count: number }>;
  mostEngaged: Array<{ name: string; phone?: string; lastInteraction: string }>;
  searchResults?: Array<{ id: string; name: string; phone?: string }>;
}

export interface IContactMetricsProvider {
  getMetrics(tenantId: string, period: string): Promise<ContactMetrics>;
  searchContacts(tenantId: string, query: string, limit?: number): Promise<ContactMetrics['searchResults']>;
}

export const CONTACT_METRICS_PROVIDER = Symbol('CONTACT_METRICS_PROVIDER');
