import { ProspectAdsInsightResult } from '../entities/ProspectAdsInsightResult';

export interface IProspectAdsInsightResultRepository {
  saveMany(results: ProspectAdsInsightResult[]): Promise<void>;
  deleteByQuery(tenantId: string, queryId: string): Promise<void>;
  findAllByQuery(
    tenantId: string,
    queryId: string,
  ): Promise<ProspectAdsInsightResult[]>;
}

export const PROSPECT_ADS_INSIGHT_RESULT_REPOSITORY = Symbol(
  'IProspectAdsInsightResultRepository',
);
