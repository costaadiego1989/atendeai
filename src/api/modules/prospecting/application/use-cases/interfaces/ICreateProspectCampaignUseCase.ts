import { IUseCase } from '@shared/application/IUseCase';

export interface CreateProspectCampaignInput {
  tenantId: string;
  name: string;
  objective: string;
  audienceType: 'REENGAGEMENT' | 'CONTACT_LIST';
  channel: 'WHATSAPP' | 'INSTAGRAM';
  targetContactIds?: string[];
  messageTemplate?: string;
  dailyLimit?: number;
}

export interface CreateProspectCampaignOutput {
  id: string;
  tenantId: string;
  name: string;
  objective: string;
  audienceType: 'REENGAGEMENT' | 'CONTACT_LIST';
  channel: 'WHATSAPP' | 'INSTAGRAM';
  targetContactIds: string[];
  messageTemplate?: string;
  dailyLimit: number;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
  createdAt: Date;
}

export interface ICreateProspectCampaignUseCase
  extends IUseCase<CreateProspectCampaignInput, CreateProspectCampaignOutput> {}

export const ICreateProspectCampaignUseCase = Symbol(
  'ICreateProspectCampaignUseCase',
);
