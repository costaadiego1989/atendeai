import { IUseCase } from '@shared/application/IUseCase';

export interface ActivateProspectCampaignInput {
  tenantId: string;
  campaignId: string;
}

export interface ActivateProspectCampaignOutput {
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

export interface IActivateProspectCampaignUseCase
  extends IUseCase<
    ActivateProspectCampaignInput,
    ActivateProspectCampaignOutput
  > {}

export const IActivateProspectCampaignUseCase = Symbol(
  'IActivateProspectCampaignUseCase',
);
