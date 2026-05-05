import { ProspectSearchSource } from '../value-objects/ProspectSearchSource';

export interface ProspectSearchSourceResult {
  externalId?: string;
  businessName: string;
  city: string;
  state?: string;
  phone?: string;
  whatsappPhone?: string;
  instagramUrl?: string;
  email?: string;
  website?: string;
}

export interface IProspectSearchSource {
  readonly source: ProspectSearchSource;
  search(input: {
    businessTypeQuery: string;
    city: string;
    state?: string;
    neighborhood?: string;
    maxResults: number;
  }): Promise<ProspectSearchSourceResult[]>;
}
