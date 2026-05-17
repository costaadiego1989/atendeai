import { IUseCase } from '@shared/application/IUseCase';

export interface StartProspectCampaignInput {
  tenantId: string;
  campaignId: string;
}

export interface StartProspectCampaignExecutionItem {
  id: string;
  contactId: string;
  status: 'PENDING' | 'CONTACTED' | 'RESPONDED' | 'STOPPED' | 'FAILED';
}

export interface StartProspectCampaignOutput {
  campaignId: string;
  createdExecutions: number;
  skippedExecutions: number;
  executions: StartProspectCampaignExecutionItem[];
}

export interface IStartProspectCampaignUseCase extends IUseCase<
  StartProspectCampaignInput,
  StartProspectCampaignOutput
> {}

export const IStartProspectCampaignUseCase = Symbol(
  'IStartProspectCampaignUseCase',
);
