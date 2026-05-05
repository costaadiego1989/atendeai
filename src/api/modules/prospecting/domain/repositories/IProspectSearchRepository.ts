import { ProspectSearch } from '../entities/ProspectSearch';

export interface IProspectSearchRepository {
  save(search: ProspectSearch): Promise<void>;
  findById(tenantId: string, id: string): Promise<ProspectSearch | null>;
  findBySearchId(id: string): Promise<ProspectSearch | null>;
  findAllByTenant(tenantId: string): Promise<ProspectSearch[]>;
}

export const PROSPECT_SEARCH_REPOSITORY = Symbol('IProspectSearchRepository');
