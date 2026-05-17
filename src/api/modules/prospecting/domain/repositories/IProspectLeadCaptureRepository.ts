import { ProspectLeadCapture } from '../entities/ProspectLeadCapture';

export interface ProspectLeadCaptureFilters {
  page: number;
  limit: number;
  campaignName?: string;
  importStatus?: string;
  channel?: 'WHATSAPP' | 'INSTAGRAM';
  dateFrom?: string;
  dateTo?: string;
}

export interface ProspectLeadCapturePage {
  items: ProspectLeadCapture[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IProspectLeadCaptureRepository {
  saveMany(leads: ProspectLeadCapture[]): Promise<void>;
  findAllByTenant(
    tenantId: string,
    filters: ProspectLeadCaptureFilters,
  ): Promise<ProspectLeadCapturePage>;
  findManyByIds(
    tenantId: string,
    leadIds: string[],
  ): Promise<ProspectLeadCapture[]>;
}

export const PROSPECT_LEAD_CAPTURE_REPOSITORY = Symbol(
  'IProspectLeadCaptureRepository',
);
