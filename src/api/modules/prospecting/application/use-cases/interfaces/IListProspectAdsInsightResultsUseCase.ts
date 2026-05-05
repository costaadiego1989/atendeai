import { IUseCase } from '@shared/application/IUseCase';

export interface ListProspectAdsInsightResultsInput {
  tenantId: string;
  queryId: string;
}

export interface ProspectAdsInsightResultListItem {
  id: string;
  queryId: string;
  resultType: 'DEMAND_ESTIMATE' | 'INTEREST' | 'REGION' | 'KEYWORD_THEME';
  title: string;
  subtitle?: string;
  metricValue?: number;
  score?: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface IListProspectAdsInsightResultsUseCase
  extends IUseCase<
    ListProspectAdsInsightResultsInput,
    ProspectAdsInsightResultListItem[]
  > {}

export const IListProspectAdsInsightResultsUseCase = Symbol(
  'IListProspectAdsInsightResultsUseCase',
);
