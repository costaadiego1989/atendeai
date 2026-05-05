import { IUseCase } from '@shared/application/IUseCase';

export interface ListProspectAdsInsightQueriesInput {
  tenantId: string;
}

export interface ProspectAdsInsightQueryListItem {
  id: string;
  tenantId: string;
  source: 'GOOGLE_ADS_AUDIENCE';
  segment: string;
  city?: string;
  state?: string;
  country: string;
  ageRange?: string;
  gender?: string;
  interest?: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  discoveredCount: number;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IListProspectAdsInsightQueriesUseCase
  extends IUseCase<
    ListProspectAdsInsightQueriesInput,
    ProspectAdsInsightQueryListItem[]
  > {}

export const IListProspectAdsInsightQueriesUseCase = Symbol(
  'IListProspectAdsInsightQueriesUseCase',
);
