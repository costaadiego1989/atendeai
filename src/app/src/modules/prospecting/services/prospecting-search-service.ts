import { apiClient } from '@/shared/api/client';
import type {
  ProspectCampaignChannel,
  ProspectCampaignDispatchNextResult,
  ProspectImportContactsResult,
  ProspectResult,
  ProspectSearch,
  ProspectSelectedResultsOutput,
} from '@/shared/types';
import { prospectingCampaignService } from './prospecting-campaign-service';
import { mapResult, mapSearch, withBranchQuery } from './prospecting-service-helpers';

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

export interface ProspectAndDispatchSelectedResultsOutput
  extends ProspectSelectedResultsOutput {
  dispatch: ProspectCampaignDispatchNextResult;
}

export const prospectingSearchService = {
  async listSearches(branchId?: string | null): Promise<ProspectSearch[]> {
    const response = await apiClient.get<
      Array<{
        id: string;
        tenantId?: string;
        businessTypeQuery: string;
        city: string;
        state?: string;
        neighborhood?: string;
        source: 'GOOGLE_PLACES';
        maxResults: number;
        status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
        discoveredCount: number;
        failureReason?: string;
        createdAt: string | Date;
        updatedAt: string | Date;
      }>
    >('/prospecting/searches', branchId ? { branchId } : undefined);

    return asArray(response).map(mapSearch);
  },

  async createSearch(input: {
    businessTypeQuery: string;
    city: string;
    state?: string;
    neighborhood?: string;
    source?: 'GOOGLE_PLACES' | 'GOOGLE_ADS_AUDIENCE';
    maxResults?: number;
  }): Promise<ProspectSearch> {
    const response = await apiClient.post('/prospecting/searches', input);
    return mapSearch(response as any);
  },

  async listSearchResults(
    searchId: string,
    branchId?: string | null,
  ): Promise<ProspectResult[]> {
    const response = await apiClient.get<
      Array<{
        id: string;
        searchId: string;
        source: 'GOOGLE_PLACES';
        externalId?: string;
        businessName: string;
        city: string;
        state?: string;
        phone?: string;
        whatsappPhone?: string;
        instagramUrl?: string;
        email?: string;
        website?: string;
        createdAt: string | Date;
      }>
    >(
      `/prospecting/searches/${searchId}/results`,
      branchId ? { branchId } : undefined,
    );

    return asArray(response).map(mapResult);
  },

  async importSearchResults(
    searchId: string,
    resultIds?: string[],
    branchId?: string | null,
  ): Promise<ProspectImportContactsResult> {
    return apiClient.post(
      withBranchQuery(`/prospecting/searches/${searchId}/import-contacts`, branchId),
      {
        resultIds,
      },
    );
  },

  async prospectSelectedResults(input: {
    searchId: string;
    resultIds: string[];
    messageTemplate: string;
    campaignName?: string;
    objective?: string;
    channel?: ProspectCampaignChannel;
    dispatchMode?: 'ASSISTED_QUEUE' | 'DIRECT_FIRST_MESSAGE';
    branchId?: string | null;
  }): Promise<ProspectSelectedResultsOutput> {
    const {
      searchId,
      resultIds,
      messageTemplate,
      campaignName,
      objective,
      channel,
      dispatchMode,
      branchId,
    } = input;

    return apiClient.post(
      withBranchQuery(`/prospecting/searches/${searchId}/prospect`, branchId),
      {
        resultIds,
        messageTemplate,
        campaignName,
        objective,
        channel,
        dispatchMode,
      },
    );
  },

  async prospectAndDispatchSelectedResults(input: {
    searchId: string;
    resultIds: string[];
    messageTemplate: string;
    campaignName?: string;
    objective?: string;
    channel?: ProspectCampaignChannel;
    branchId?: string | null;
  }): Promise<ProspectAndDispatchSelectedResultsOutput> {
    const prospectResult = await this.prospectSelectedResults({
      ...input,
      dispatchMode: 'DIRECT_FIRST_MESSAGE',
    });

    await prospectingCampaignService.activateCampaign(prospectResult.campaignId);
    const dispatch = await prospectingCampaignService.dispatchNextCampaignExecution(
      prospectResult.campaignId,
    );

    return {
      ...prospectResult,
      dispatchedExecutions: 1,
      dispatch,
    };
  },
};
