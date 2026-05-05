import { apiClient } from '@/shared/api/client';
import type {
  AdsInsightQuery,
  AdsInsightResult,
  AdsLeadCapture,
  AdsLeadCapturesPage,
  GoogleAdsAccessibleAccount,
  GoogleAdsConnectionStatus,
  ProspectCampaignChannel,
} from '@/shared/types';
import { toIso } from './prospecting-service-helpers';

function asArray<T>(value: T[] | { data?: T[]; items?: T[] } | null | undefined): T[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value?.data)) {
    return value.data;
  }

  if (Array.isArray(value?.items)) {
    return value.items;
  }

  return [];
}

export const prospectingAdsService = {
  async getGoogleAdsConnectionStatus(): Promise<GoogleAdsConnectionStatus> {
    return apiClient.get('/prospecting/ads/connection/status');
  },

  async startGoogleAdsConnection(): Promise<{ authorizationUrl: string }> {
    return apiClient.post('/prospecting/ads/connection/start');
  },

  async listGoogleAdsAccounts(): Promise<GoogleAdsAccessibleAccount[]> {
    const response = await apiClient.get<
      GoogleAdsAccessibleAccount[] | { data?: GoogleAdsAccessibleAccount[]; items?: GoogleAdsAccessibleAccount[] }
    >('/prospecting/ads/connection/accounts');

    return asArray(response);
  },

  async selectGoogleAdsAccount(
    customerId: string,
  ): Promise<GoogleAdsConnectionStatus> {
    return apiClient.post('/prospecting/ads/connection/select-account', {
      customerId,
    });
  },

  async disconnectGoogleAdsConnection(): Promise<{ disconnected: boolean }> {
    return apiClient.delete('/prospecting/ads/connection');
  },

  async listAdsInsightQueries(): Promise<AdsInsightQuery[]> {
    const response = await apiClient.get<any[]>(
      '/prospecting/ads/insights/queries',
    );
    return asArray(response).map((item) => ({
      ...item,
      createdAt: toIso(item.createdAt),
      updatedAt: toIso(item.updatedAt),
    }));
  },

  async createAdsInsightQuery(input: {
    segment: string;
    city?: string;
    state?: string;
    country?: string;
    ageRange?: string;
    gender?: string;
    interest?: string;
  }): Promise<AdsInsightQuery> {
    const response = await apiClient.post(
      '/prospecting/ads/insights/queries',
      input,
    );
    return {
      ...(response as any),
      createdAt: toIso((response as any).createdAt),
      updatedAt: toIso((response as any).updatedAt),
    };
  },

  async listAdsInsightResults(queryId: string): Promise<AdsInsightResult[]> {
    const response = await apiClient.get<any[]>(
      `/prospecting/ads/insights/queries/${queryId}/results`,
    );
    return asArray(response).map((item) => ({
      ...item,
      createdAt: toIso(item.createdAt),
    }));
  },

  async syncAdsLeads(limit?: number): Promise<{ syncedCount: number }> {
    return apiClient.post('/prospecting/ads/leads/sync', {
      limit,
    });
  },

  async listAdsLeads(filters?: {
    page?: number;
    limit?: number;
    campaignName?: string;
    importStatus?: string;
    channel?: 'WHATSAPP' | 'INSTAGRAM';
    dateFrom?: string;
    dateTo?: string;
  }): Promise<AdsLeadCapturesPage> {
    const params = new URLSearchParams();
    if (filters?.page) params.set('page', String(filters.page));
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.campaignName) params.set('campaignName', filters.campaignName);
    if (filters?.importStatus) params.set('importStatus', filters.importStatus);
    if (filters?.channel) params.set('channel', filters.channel);
    if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params.set('dateTo', filters.dateTo);

    const query = params.toString();
    const response = await apiClient.get<any>(
      `/prospecting/ads/leads${query ? `?${query}` : ''}`,
    );

    return {
      items: asArray<AdsLeadCapture>(response.items).map((item: any) => ({
        ...(item as AdsLeadCapture),
        submissionAt: toIso(item.submissionAt),
      })),
      pagination: response.pagination,
    };
  },

  async importAdsLeads(leadIds: string[]) {
    return apiClient.post('/prospecting/ads/leads/import-contacts', {
      leadIds,
    });
  },

  async prospectAdsLeads(input: {
    leadIds: string[];
    messageTemplate: string;
    campaignName?: string;
    objective?: string;
    channel?: ProspectCampaignChannel;
  }) {
    return apiClient.post('/prospecting/ads/leads/prospect', input);
  },
};
