import { IUseCase } from '@shared/application/IUseCase';

export interface ListProspectSearchesInput {
  tenantId: string;
}

export interface ProspectSearchListItem {
  id: string;
  tenantId: string;
  businessTypeQuery: string;
  city: string;
  state?: string;
  neighborhood?: string;
  source: 'GOOGLE_PLACES' | 'GOOGLE_ADS_AUDIENCE';
  maxResults: number;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  discoveredCount: number;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IListProspectSearchesUseCase extends IUseCase<
  ListProspectSearchesInput,
  ProspectSearchListItem[]
> {}

export const IListProspectSearchesUseCase = Symbol(
  'IListProspectSearchesUseCase',
);
