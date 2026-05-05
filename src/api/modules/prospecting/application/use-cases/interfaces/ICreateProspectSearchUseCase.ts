import { IUseCase } from '@shared/application/IUseCase';

export interface CreateProspectSearchInput {
  tenantId: string;
  businessTypeQuery: string;
  city: string;
  state?: string;
  neighborhood?: string;
  source?: 'GOOGLE_PLACES' | 'GOOGLE_ADS_AUDIENCE';
  maxResults?: number;
}

export interface CreateProspectSearchOutput {
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
}

export interface ICreateProspectSearchUseCase
  extends IUseCase<CreateProspectSearchInput, CreateProspectSearchOutput> {}

export const ICreateProspectSearchUseCase = Symbol(
  'ICreateProspectSearchUseCase',
);
