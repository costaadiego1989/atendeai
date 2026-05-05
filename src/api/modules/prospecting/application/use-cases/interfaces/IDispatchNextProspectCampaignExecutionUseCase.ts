import { IUseCase } from '@shared/application/IUseCase';

export interface DispatchNextProspectCampaignExecutionInput {
  tenantId: string;
  campaignId: string;
}

export interface DispatchNextProspectCampaignExecutionOutput {
  campaignId: string;
  executionId: string;
  conversationId: string;
  messageId: string;
  status: 'PENDING' | 'CONTACTED' | 'RESPONDED' | 'STOPPED' | 'FAILED';
  renderedMessage: string;
  remainingPendingExecutions: number;
}

export interface IDispatchNextProspectCampaignExecutionUseCase
  extends IUseCase<
    DispatchNextProspectCampaignExecutionInput,
    DispatchNextProspectCampaignExecutionOutput
  > {}

export const IDispatchNextProspectCampaignExecutionUseCase = Symbol(
  'IDispatchNextProspectCampaignExecutionUseCase',
);
