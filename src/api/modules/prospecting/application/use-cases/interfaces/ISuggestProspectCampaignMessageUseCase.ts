import { IUseCase } from '@shared/application/IUseCase';

export interface SuggestProspectCampaignMessageInput {
  tenantId: string;
  branchId?: string | null;
  objective: string;
  audienceType: 'REENGAGEMENT' | 'CONTACT_LIST';
  channels: Array<'WHATSAPP' | 'INSTAGRAM'>;
  stageFilter?: 'LEAD' | 'PROSPECT' | 'OPPORTUNITY' | 'CUSTOMER' | 'INACTIVE';
  searchTerm?: string;
  selectedCount: number;
  selectedContacts: Array<{
    name: string;
    stage?: string;
    phone?: string;
    email?: string;
  }>;
}

export interface SuggestProspectCampaignMessageOutput {
  messageTemplate: string;
}

export interface ISuggestProspectCampaignMessageUseCase
  extends IUseCase<
    SuggestProspectCampaignMessageInput,
    SuggestProspectCampaignMessageOutput
  > {}

export const ISuggestProspectCampaignMessageUseCase = Symbol(
  'ISuggestProspectCampaignMessageUseCase',
);
