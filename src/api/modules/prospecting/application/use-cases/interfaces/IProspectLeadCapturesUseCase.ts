import { IUseCase } from '@shared/application/IUseCase';

export interface ProspectLeadCapturesInput {
  tenantId: string;
  leadIds: string[];
  messageTemplate: string;
  campaignName?: string;
  objective?: string;
  channel?: 'WHATSAPP' | 'INSTAGRAM';
}

export interface ProspectLeadCapturesOutput {
  campaignId: string;
  importedCount: number;
  reusedExistingContacts: number;
  skippedMissingPhone: number;
  dispatchedExecutions: number;
  targetContactIds: string[];
}

export interface IProspectLeadCapturesUseCase
  extends IUseCase<ProspectLeadCapturesInput, ProspectLeadCapturesOutput> {}

export const IProspectLeadCapturesUseCase = Symbol(
  'IProspectLeadCapturesUseCase',
);
