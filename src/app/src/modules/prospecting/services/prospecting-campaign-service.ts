import { apiClient } from '@/shared/api/client';
import type {
  Campaign,
  ProspectCampaignAudienceType,
  ProspectCampaignChannel,
  ProspectCampaignDispatchNextResult,
  ProspectCampaignStartResult,
} from '@/shared/types';
import { mapCampaign, withBranchQuery } from './prospecting-service-helpers';

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

export const prospectingCampaignService = {
  async listCampaigns(branchId?: string | null): Promise<Campaign[]> {
    const response = await apiClient.get<
      Array<{
        id: string;
        tenantId?: string;
        name: string;
        objective: string;
        audienceType: ProspectCampaignAudienceType;
        channel: ProspectCampaignChannel;
        targetContactIds: string[];
        messageTemplate?: string;
        dailyLimit: number;
        status: Campaign['status'];
        createdAt: string | Date;
      }>
    >('/prospecting/campaigns', branchId ? { branchId } : undefined);

    return asArray(response).map(mapCampaign);
  },

  async createCampaign(input: {
    name: string;
    objective: string;
    audienceType: ProspectCampaignAudienceType;
    channel: ProspectCampaignChannel;
    targetContactIds?: string[];
    messageTemplate?: string;
    dailyLimit?: number;
  }): Promise<Campaign> {
    const response = await apiClient.post('/prospecting/campaigns', input);
    return mapCampaign(response as any);
  },

  async suggestCampaignMessage(input: {
    objective: string;
    audienceType: ProspectCampaignAudienceType;
    channels: ProspectCampaignChannel[];
    stageFilter?: 'LEAD' | 'PROSPECT' | 'OPPORTUNITY' | 'CUSTOMER' | 'INACTIVE';
    searchTerm?: string;
    selectedCount: number;
    selectedContacts: Array<{
      name: string;
      stage?: string;
      phone?: string;
      email?: string;
    }>;
    branchId?: string | null;
  }): Promise<{ messageTemplate: string }> {
    const { branchId, ...payload } = input;
    return apiClient.post(
      withBranchQuery('/prospecting/campaigns/message-suggestion', branchId),
      payload,
    );
  },

  async activateCampaign(campaignId: string): Promise<Campaign> {
    const response = await apiClient.patch(
      `/prospecting/campaigns/${campaignId}/activate`,
    );
    return mapCampaign(response as any);
  },

  async pauseCampaign(campaignId: string): Promise<Campaign> {
    const response = await apiClient.patch(
      `/prospecting/campaigns/${campaignId}/pause`,
    );
    return mapCampaign(response as any);
  },

  async startCampaign(campaignId: string): Promise<ProspectCampaignStartResult> {
    return apiClient.post(`/prospecting/campaigns/${campaignId}/start`);
  },

  async dispatchNextCampaignExecution(
    campaignId: string,
  ): Promise<ProspectCampaignDispatchNextResult> {
    return apiClient.post(`/prospecting/campaigns/${campaignId}/dispatch-next`);
  },
};
