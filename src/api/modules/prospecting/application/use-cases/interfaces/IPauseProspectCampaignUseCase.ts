import { IUseCase } from '@shared/application/IUseCase';

export interface PauseProspectCampaignInput {
  tenantId: string;
  campaignId: string;
}

export interface PauseProspectCampaignOutput {
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

export interface IPauseProspectCampaignUseCase extends IUseCase<
  PauseProspectCampaignInput,
  PauseProspectCampaignOutput
> {}

export const IPauseProspectCampaignUseCase = Symbol(
  'IPauseProspectCampaignUseCase',
);
