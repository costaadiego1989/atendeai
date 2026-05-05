import { IUseCase } from '@shared/application/IUseCase';

export interface CreateProspectAdsInsightQueryInput {
  tenantId: string;
  segment: string;
  city?: string;
  state?: string;
  country?: string;
  ageRange?: string;
  gender?: string;
  interest?: string;
}

export interface CreateProspectAdsInsightQueryOutput {
  id: string;
  tenantId: string;
  source: 'GOOGLE_ADS_AUDIENCE';
  segment: string;
  city?: string;
  state?: string;
  country: string;
  ageRange?: string;
  gender?: string;
  interest?: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  discoveredCount: number;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateProspectAdsInsightQueryUseCase
  extends IUseCase<
    CreateProspectAdsInsightQueryInput,
    CreateProspectAdsInsightQueryOutput
  > {}

export const ICreateProspectAdsInsightQueryUseCase = Symbol(
  'ICreateProspectAdsInsightQueryUseCase',
);
