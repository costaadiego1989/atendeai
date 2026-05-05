import { ProspectSearchSource } from '../value-objects/ProspectSearchSource';
import { IProspectSearchSource } from './IProspectSearchSource';

export interface IProspectSearchSourceRegistry {
  resolve(source: ProspectSearchSource): IProspectSearchSource | null;
}

export const PROSPECT_SEARCH_SOURCE_REGISTRY = Symbol(
  'IProspectSearchSourceRegistry',
);
