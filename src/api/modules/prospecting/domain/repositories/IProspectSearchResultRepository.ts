import { ProspectSearchResult } from '../entities/ProspectSearchResult';

export interface IProspectSearchResultRepository {
  saveMany(results: ProspectSearchResult[]): Promise<void>;
  deleteBySearch(tenantId: string, searchId: string): Promise<void>;
  findAllBySearch(
    tenantId: string,
    searchId: string,
  ): Promise<ProspectSearchResult[]>;
}

export const PROSPECT_SEARCH_RESULT_REPOSITORY = Symbol(
  'IProspectSearchResultRepository',
);
