import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import { ListProspectSearchResultsUseCase } from '../application/use-cases/ListProspectSearchResultsUseCase';
import { IProspectSearchRepository } from '../domain/repositories/IProspectSearchRepository';
import { IProspectSearchResultRepository } from '../domain/repositories/IProspectSearchResultRepository';
import { ProspectSearch } from '../domain/entities/ProspectSearch';
import { ProspectSearchResult } from '../domain/entities/ProspectSearchResult';
import { ProspectSearchSourceVO } from '../domain/value-objects/ProspectSearchSource';
import { TenantId } from '@shared/domain/TenantId';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';

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

describe('ListProspectSearchResultsUseCase', () => {
  let useCase: ListProspectSearchResultsUseCase;
  let searchRepository: jest.Mocked<IProspectSearchRepository>;
  let searchResultRepository: jest.Mocked<IProspectSearchResultRepository>;

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
    };

    useCase = new ListProspectSearchResultsUseCase(
      searchRepository,
      searchResultRepository,
    );
  });

  it('should list search results for a tenant-owned search', async () => {
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
        phone: '1933334444',
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
    ]);

    const result = await useCase.execute({
      tenantId: search.tenantId.toString(),
      searchId: search.id.toString(),
    });

    expect(searchResultRepository.findAllBySearch).toHaveBeenCalledWith(
      search.tenantId.toString(),
      search.id.toString(),
    );
    expect(result).toEqual([
      expect.objectContaining({
        externalId: 'place-1',
        businessName: 'Clinica Sorriso',
        city: 'Campinas',
        state: 'SP',
      }),
      expect.objectContaining({
        externalId: 'place-2',
        businessName: 'Odonto Centro',
      }),
    ]);
  });

  it('should throw when the search does not belong to the tenant', async () => {
    searchRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        searchId: new UniqueEntityID().toString(),
      }),
    ).rejects.toThrow(EntityNotFoundException);
  });
});
