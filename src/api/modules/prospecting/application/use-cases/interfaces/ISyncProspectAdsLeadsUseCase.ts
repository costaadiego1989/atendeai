import { IUseCase } from '@shared/application/IUseCase';

export interface SyncProspectAdsLeadsInput {
  tenantId: string;
  limit?: number;
}

export interface SyncProspectAdsLeadsOutput {
  syncedCount: number;
  leads: Array<{
    id: string;
    externalLeadId: string;
    campaignName?: string;
    formName?: string;
    fullName?: string;
    phone?: string;
    email?: string;
    submissionAt: Date;
  }>;
}

export interface ISyncProspectAdsLeadsUseCase extends IUseCase<
  SyncProspectAdsLeadsInput,
  SyncProspectAdsLeadsOutput
> {}

export const ISyncProspectAdsLeadsUseCase = Symbol(
  'ISyncProspectAdsLeadsUseCase',
);
