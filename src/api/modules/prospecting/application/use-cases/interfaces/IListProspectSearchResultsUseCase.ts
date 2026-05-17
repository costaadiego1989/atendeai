import { IUseCase } from '@shared/application/IUseCase';

export interface ListProspectSearchResultsInput {
  tenantId: string;
  searchId: string;
}

export interface ProspectSearchResultListItem {
  id: string;
  searchId: string;
  source: 'GOOGLE_PLACES' | 'GOOGLE_ADS_AUDIENCE';
  externalId?: string;
  businessName: string;
  city: string;
  state?: string;
  phone?: string;
  whatsappPhone?: string;
  instagramUrl?: string;
  email?: string;
  website?: string;
  createdAt: Date;
}

export interface IListProspectSearchResultsUseCase extends IUseCase<
  ListProspectSearchResultsInput,
  ProspectSearchResultListItem[]
> {}

export const IListProspectSearchResultsUseCase = Symbol(
  'IListProspectSearchResultsUseCase',
);
