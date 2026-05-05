export interface ImportProspectSearchResultsInput {
  tenantId: string;
  searchId: string;
  branchId?: string;
  resultIds?: string[];
}

export interface ImportProspectSearchResultsOutput {
  searchId: string;
  importedCount: number;
  skippedMissingPhone: number;
  skippedDuplicates: number;
  importedContacts: Array<{
    id: string;
    name: string;
    phone: string;
    email?: string;
  }>;
}

export interface IImportProspectSearchResultsUseCase {
  execute(
    input: ImportProspectSearchResultsInput,
  ): Promise<ImportProspectSearchResultsOutput>;
}

export const IImportProspectSearchResultsUseCase = Symbol(
  'IImportProspectSearchResultsUseCase',
);
