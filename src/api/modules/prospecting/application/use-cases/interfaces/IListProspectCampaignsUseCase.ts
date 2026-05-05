import { IUseCase } from '@shared/application/IUseCase';

export interface ListProspectCampaignsInput {
  tenantId: string;
}

export interface ProspectCampaignListItem {
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

export interface IListProspectCampaignsUseCase
  extends IUseCase<ListProspectCampaignsInput, ProspectCampaignListItem[]> {}

export const IListProspectCampaignsUseCase = Symbol(
  'IListProspectCampaignsUseCase',
);
