import { Inject, Injectable } from '@nestjs/common';
import {
  EntityNotFoundException,
  ValidationErrorException,
} from '@shared/domain/exceptions/DomainExceptions';
import {
  IProspectSearchRepository,
  PROSPECT_SEARCH_REPOSITORY,
} from '../../domain/repositories/IProspectSearchRepository';
import {
  IProspectSearchResultRepository,
  PROSPECT_SEARCH_RESULT_REPOSITORY,
} from '../../domain/repositories/IProspectSearchResultRepository';
import {
  CONTACT_FACADE,
  IContactFacade,
} from '@modules/contact/application/facades/ContactFacade';
import {
  IImportProspectSearchResultsUseCase,
  ImportProspectSearchResultsInput,
  ImportProspectSearchResultsOutput,
} from './interfaces/IImportProspectSearchResultsUseCase';
import { ProspectSearchResult } from '../../domain/entities/ProspectSearchResult';

@Injectable()
export class ImportProspectSearchResultsUseCase
  implements IImportProspectSearchResultsUseCase {
  constructor(
    @Inject(PROSPECT_SEARCH_REPOSITORY)
    private readonly searchRepository: IProspectSearchRepository,
    @Inject(PROSPECT_SEARCH_RESULT_REPOSITORY)
    private readonly searchResultRepository: IProspectSearchResultRepository,
    @Inject(CONTACT_FACADE)
    private readonly contactFacade: IContactFacade,
  ) { }

  async execute(
    input: ImportProspectSearchResultsInput,
  ): Promise<ImportProspectSearchResultsOutput> {
    const search = await this.searchRepository.findById(
      input.tenantId,
      input.searchId,
    );

    if (!search) {
      throw new EntityNotFoundException('ProspectSearch', input.searchId);
    }

    const results = await this.searchResultRepository.findAllBySearch(
      input.tenantId,
      input.searchId,
    );
    const selectedResults = this.selectResults(results, input.resultIds);

    const importedContacts: ImportProspectSearchResultsOutput['importedContacts'] =
      [];
    let skippedMissingPhone = 0;
    let skippedDuplicates = 0;

    for (const result of selectedResults) {
      const normalizedPhone = this.normalizePhone(result.phone);
      if (!normalizedPhone) {
        skippedMissingPhone += 1;
        continue;
      }

      const upsertResult = await this.contactFacade.upsertProspectContact({
        tenantId: input.tenantId,
        branchId: input.branchId,
        name: result.businessName,
        phone: normalizedPhone,
        email: result.email,
        notes: this.buildNotes(result.website, result.city, result.state),
        tags: [
          'prospecting',
          `source:${result.source.value.toLowerCase()}`,
          'temperature:cold',
        ],
      });

      if (!upsertResult.created) {
        skippedDuplicates += 1;
        continue;
      }

      importedContacts.push({
        id: upsertResult.contactId,
        name: result.businessName,
        phone: normalizedPhone,
        email: result.email,
      });
    }

    return {
      searchId: search.id.toString(),
      importedCount: importedContacts.length,
      skippedMissingPhone,
      skippedDuplicates,
      importedContacts,
    };
  }

  private normalizePhone(phone?: string): string | undefined {
    if (!phone?.trim()) {
      return undefined;
    }

    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      return undefined;
    }

    return digits.startsWith('55') ? digits : `55${digits}`;
  }

  private buildNotes(
    website?: string,
    city?: string,
    state?: string,
  ): string | undefined {
    const parts = [
      'Importado da captação automatizada',
      city ? `Cidade: ${city}${state ? `/${state}` : ''}` : undefined,
      website ? `Website: ${website}` : undefined,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(' | ') : undefined;
  }

  private selectResults(
    results: ProspectSearchResult[],
    resultIds?: string[],
  ): ProspectSearchResult[] {
    if (!resultIds?.length) {
      return results;
    }

    const selectedIds = new Set(resultIds);
    const selectedResults = results.filter((result) =>
      selectedIds.has(result.id.toString()),
    );

    if (selectedResults.length === 0) {
      throw new ValidationErrorException(
        'No selected prospect search results were found',
      );
    }

    return selectedResults;
  }
}
