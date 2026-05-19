import { ImportProspectSearchResultsUseCase } from '../application/use-cases/ImportProspectSearchResultsUseCase';
import { IProspectSearchRepository } from '../domain/repositories/IProspectSearchRepository';
import { IProspectSearchResultRepository } from '../domain/repositories/IProspectSearchResultRepository';
import { ProspectSearch } from '../domain/entities/ProspectSearch';
import { ProspectSearchResult } from '../domain/entities/ProspectSearchResult';
import { ProspectSearchSourceVO } from '../domain/value-objects/ProspectSearchSource';
import { TenantId } from '@shared/domain/TenantId';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import { IContactFacade } from '@modules/contact/application/facades/ContactFacade';

function makeSearch() {
  return ProspectSearch.create({
    tenantId: TenantId.create('f0e9c8b0-4f78-4a1c-bb62-1d67ad55a111'),
    businessTypeQuery: 'Clinica odontologica',
    city: 'Campinas',
    state: 'SP',
    source: ProspectSearchSourceVO.create('GOOGLE_PLACES'),
    maxResults: 80,
  });
}

describe('ImportProspectSearchResultsUseCase', () => {
  let useCase: ImportProspectSearchResultsUseCase;
  let searchRepository: jest.Mocked<IProspectSearchRepository>;
  let searchResultRepository: jest.Mocked<IProspectSearchResultRepository>;
  let contactFacade: jest.Mocked<IContactFacade>;

  beforeEach(() => {
    searchRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findBySearchId: jest.fn(),
      findAllByTenant: jest.fn(),
    };

    searchResultRepository = {
      saveMany: jest.fn(),
      findAllBySearch: jest.fn(),
      deleteBySearch: jest.fn(),
    };

    contactFacade = {
      identifyContact: jest.fn(),
      getContactById: jest.fn(),
      ensureContact: jest.fn(),
      upsertProspectContact: jest.fn(),
      findContactIdsForReengagementAudience: jest.fn(),
      markProspectingOptOut: jest.fn(),
    };

    useCase = new ImportProspectSearchResultsUseCase(
      searchRepository,
      searchResultRepository,
      contactFacade,
    );
  });

  it('should import actionable results as contacts and skip duplicates/missing phone', async () => {
    const search = makeSearch();
    searchRepository.findById.mockResolvedValue(search);
    searchResultRepository.findAllBySearch.mockResolvedValue([
      ProspectSearchResult.create({
        tenantId: search.tenantId,
        searchId: search.id,
        source: search.source,
        externalId: 'place-1',
        businessName: 'Clinica Sorriso',
        city: 'Campinas',
        state: 'SP',
        phone: '(19) 3333-4444',
        email: 'contato@clinicasorriso.com.br',
        website: 'https://clinicasorriso.com.br',
      }),
      ProspectSearchResult.create({
        tenantId: search.tenantId,
        searchId: search.id,
        source: search.source,
        externalId: 'place-2',
        businessName: 'Odonto Centro',
        city: 'Campinas',
      }),
      ProspectSearchResult.create({
        tenantId: search.tenantId,
        searchId: search.id,
        source: search.source,
        externalId: 'place-3',
        businessName: 'Clinica Ja Existe',
        city: 'Campinas',
        phone: '(19) 3555-6666',
      }),
    ]);
    contactFacade.upsertProspectContact
      .mockResolvedValueOnce({ contactId: 'contact-1', created: true })
      .mockResolvedValueOnce({ contactId: 'contact-2', created: false });

    const result = await useCase.execute({
      tenantId: search.tenantId.toString(),
      searchId: search.id.toString(),
    });

    expect(contactFacade.upsertProspectContact).toHaveBeenCalledTimes(2);
    expect(contactFacade.upsertProspectContact).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        phone: '551933334444',
        email: 'contato@clinicasorriso.com.br',
        tags: expect.arrayContaining([
          'prospecting',
          'source:google_places',
          'temperature:cold',
        ]),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        importedCount: 1,
        skippedMissingPhone: 1,
        skippedDuplicates: 1,
      }),
    );
  });

  it('should only import the selected results when resultIds are provided', async () => {
    const search = makeSearch();
    const selectedResult = ProspectSearchResult.create({
      tenantId: search.tenantId,
      searchId: search.id,
      source: search.source,
      externalId: 'place-1',
      businessName: 'Clinica Sorriso',
      city: 'Campinas',
      phone: '(19) 3333-4444',
    });
    const ignoredResult = ProspectSearchResult.create({
      tenantId: search.tenantId,
      searchId: search.id,
      source: search.source,
      externalId: 'place-2',
      businessName: 'não Importar',
      city: 'Campinas',
      phone: '(19) 3555-6666',
    });

    searchRepository.findById.mockResolvedValue(search);
    searchResultRepository.findAllBySearch.mockResolvedValue([
      selectedResult,
      ignoredResult,
    ]);
    contactFacade.upsertProspectContact.mockResolvedValue({
      contactId: 'contact-1',
      created: true,
    });

    const result = await useCase.execute({
      tenantId: search.tenantId.toString(),
      searchId: search.id.toString(),
      resultIds: [selectedResult.id.toString()],
    });

    expect(contactFacade.upsertProspectContact).toHaveBeenCalledTimes(1);
    expect(result.importedCount).toBe(1);
  });

  it('should throw when the search does not belong to the tenant', async () => {
    searchRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        searchId: 'search-1',
      }),
    ).rejects.toThrow(EntityNotFoundException);
  });
});
