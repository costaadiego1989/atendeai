import { ProspectChannel } from '../../../domain/value-objects/ProspectChannel';

export interface ProspectSelectedSearchResultsInput {
  tenantId: string;
  searchId: string;
  resultIds: string[];
  messageTemplate: string;
  channel?: ProspectChannel;
  campaignName?: string;
  objective?: string;
  dispatchMode?: 'ASSISTED_QUEUE' | 'DIRECT_FIRST_MESSAGE';
}

export interface ProspectSelectedSearchResultsOutput {
  searchId: string;
  campaignId: string;
  importedCount: number;
  reusedExistingContacts: number;
  skippedMissingPhone: number;
  dispatchedExecutions: number;
  targetContactIds: string[];
}

export interface IProspectSelectedSearchResultsUseCase {
  execute(
    input: ProspectSelectedSearchResultsInput,
  ): Promise<ProspectSelectedSearchResultsOutput>;
}

export const IProspectSelectedSearchResultsUseCase = Symbol(
  'IProspectSelectedSearchResultsUseCase',
);
