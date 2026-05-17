import { IUseCase } from '@shared/application/IUseCase';

export interface ImportProspectLeadCapturesInput {
  tenantId: string;
  leadIds: string[];
}

export interface ImportProspectLeadCapturesOutput {
  importedCount: number;
  reusedExistingContacts: number;
  skippedMissingPhone: number;
  importedContacts: Array<{
    id: string;
    name: string;
    phone: string;
    email?: string;
  }>;
}

export interface IImportProspectLeadCapturesUseCase extends IUseCase<
  ImportProspectLeadCapturesInput,
  ImportProspectLeadCapturesOutput
> {}

export const IImportProspectLeadCapturesUseCase = Symbol(
  'IImportProspectLeadCapturesUseCase',
);
