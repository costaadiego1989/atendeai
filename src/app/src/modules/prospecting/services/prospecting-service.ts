import { apiClient, BASE_URL } from '@/shared/api/client';
import type { ProspectingAsyncJob } from '@/shared/types';
import { prospectingAdsService } from './prospecting-ads-service';
import { prospectingCampaignService } from './prospecting-campaign-service';
import { withBranchQuery } from './prospecting-service-helpers';
import { prospectingSearchService } from './prospecting-search-service';

export const prospectingService = {
  withBranchQuery,
  async startSearchReportJob(input: {
    query?: string;
    statuses?: Array<'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'>;
    sources?: Array<'GOOGLE_PLACES' | 'GOOGLE_ADS_AUDIENCE'>;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<ProspectingAsyncJob> {
    return apiClient.post<ProspectingAsyncJob>('/prospecting/reports/search-jobs', input);
  },
  async startCampaignReportJob(input: {
    query?: string;
    statuses?: Array<'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED'>;
    channels?: Array<'WHATSAPP' | 'INSTAGRAM'>;
    audienceTypes?: Array<'REENGAGEMENT' | 'CONTACT_LIST'>;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<ProspectingAsyncJob> {
    return apiClient.post<ProspectingAsyncJob>('/prospecting/reports/campaign-jobs', input);
  },
  async listAsyncJobs(): Promise<ProspectingAsyncJob[]> {
    return apiClient.get<ProspectingAsyncJob[]>('/prospecting/reports/jobs');
  },
  async downloadAsyncJobFile(jobId: string, fallbackFileName?: string): Promise<void> {
    const anchor = document.createElement('a');
    anchor.href = `${BASE_URL}/prospecting/reports/jobs/${jobId}/download`;
    anchor.download = fallbackFileName ?? `prospecting-${jobId}.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  },
  ...prospectingAdsService,
  ...prospectingSearchService,
  ...prospectingCampaignService,
};

export {
  prospectingAdsService,
  prospectingCampaignService,
  prospectingSearchService,
};
