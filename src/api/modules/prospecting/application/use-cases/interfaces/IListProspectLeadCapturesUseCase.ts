import { IUseCase } from '@shared/application/IUseCase';

export interface ListProspectLeadCapturesInput {
  tenantId: string;
  page?: number;
  limit?: number;
  campaignName?: string;
  importStatus?: string;
  channel?: 'WHATSAPP' | 'INSTAGRAM';
  dateFrom?: string;
  dateTo?: string;
}

export interface ProspectLeadCaptureListItem {
  id: string;
  source: 'GOOGLE_ADS_LEAD_FORM';
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
  interests?: Record<string, unknown>;
  rawPayload?: Record<string, unknown>;
  submissionAt: Date;
  importStatus: 'NEW' | 'IMPORTED' | 'REUSED' | 'SKIPPED_NO_PHONE';
  contactId?: string;
}

export interface ListProspectLeadCapturesOutput {
  items: ProspectLeadCaptureListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface IListProspectLeadCapturesUseCase extends IUseCase<
  ListProspectLeadCapturesInput,
  ListProspectLeadCapturesOutput
> {}

export const IListProspectLeadCapturesUseCase = Symbol(
  'IListProspectLeadCapturesUseCase',
);
