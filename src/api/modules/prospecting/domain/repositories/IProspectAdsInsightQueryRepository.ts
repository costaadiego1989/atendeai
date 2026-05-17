import { ProspectAdsInsightQuery } from '../entities/ProspectAdsInsightQuery';

export interface IProspectAdsInsightQueryRepository {
  save(query: ProspectAdsInsightQuery): Promise<void>;
  findById(
    tenantId: string,
    queryId: string,
  ): Promise<ProspectAdsInsightQuery | null>;
  findAllByTenant(tenantId: string): Promise<ProspectAdsInsightQuery[]>;
}

export const PROSPECT_ADS_INSIGHT_QUERY_REPOSITORY = Symbol(
  'IProspectAdsInsightQueryRepository',
);
