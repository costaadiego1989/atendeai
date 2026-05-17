export interface GoogleAdsLeadField {
  key: string;
  value: string;
}

export interface GoogleAdsLeadItem {
  externalLeadId: string;
  googleAdsCustomerId?: string;
  campaignName?: string;
  formName?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
  instagramHandle?: string;
  document?: string;
  submissionAt: Date;
  fields: GoogleAdsLeadField[];
  rawPayload?: Record<string, unknown>;
}

export interface IGoogleAdsLeadSource {
  pullLeads(input: {
    tenantId: string;
    limit?: number;
  }): Promise<GoogleAdsLeadItem[]>;
}

export const GOOGLE_ADS_LEAD_SOURCE = Symbol('IGoogleAdsLeadSource');
