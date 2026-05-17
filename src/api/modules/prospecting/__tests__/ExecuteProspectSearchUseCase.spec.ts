import { ExecuteProspectSearchUseCase } from '../application/use-cases/ExecuteProspectSearchUseCase';
import { IProspectSearchRepository } from '../domain/repositories/IProspectSearchRepository';
import { IProspectSearchResultRepository } from '../domain/repositories/IProspectSearchResultRepository';
import { IProspectSearchSourceRegistry } from '../domain/ports/IProspectSearchSourceRegistry';
import { IProspectWebsiteEnricher } from '../domain/ports/IProspectWebsiteEnricher';
import { ProspectSearch } from '../domain/entities/ProspectSearch';
import { ProspectSearchSourceVO } from '../domain/value-objects/ProspectSearchSource';
import { TenantId } from '@shared/domain/TenantId';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import { ICheckQuotaUseCase } from '@modules/billing/application/use-cases/interfaces/ICheckQuotaUseCase';
import {
  IRecordUsageUseCase,
  UsageType,
} from '@modules/billing/application/use-cases/interfaces/IRecordUsageUseCase';

function makePendingSearch() {
  return ProspectSearch.create({
    tenantId: TenantId.create('f0e9c8b0-4f78-4a1c-bb62-1d67ad55a111'),
    businessTypeQuery: 'Clinica odontologica',
    city: 'Campinas',
    state: 'SP',
    source: ProspectSearchSourceVO.create('GOOGLE_PLACES'),
    maxResults: 80,
  });
}

describe('ExecuteProspectSearchUseCase', () => {
  let useCase: ExecuteProspectSearchUseCase;
  let searchRepository: jest.Mocked<IProspectSearchRepository>;
  let searchResultRepository: jest.Mocked<IProspectSearchResultRepository>;
  let sourceRegistry: jest.Mocked<IProspectSearchSourceRegistry>;
  let websiteEnricher: jest.Mocked<IProspectWebsiteEnricher>;
  let checkQuotaUseCase: jest.Mocked<ICheckQuotaUseCase>;
  let recordUsageUseCase: jest.Mocked<IRecordUsageUseCase>;
  let prospectingQuotaService: { assertCanConsume: jest.Mock };

  beforeEach(() => {
    searchRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findBySearchId: jest.fn(),
      findAllByTenant: jest.fn(),
    };

    searchResultRepository = {
      saveMany: jest.fn(),
      deleteBySearch: jest.fn(),
      findAllBySearch: jest.fn(),
    };

    sourceRegistry = {
      resolve: jest.fn(),
    };

    websiteEnricher = {
      enrich: jest.fn(),
    };

    checkQuotaUseCase = {
      execute: jest.fn().mockResolvedValue({
        canProceed: true,
        used: 0,
        quota: 1000,
        status: 'ACTIVE',
      }),
    };

    recordUsageUseCase = {
      execute: jest.fn(),
    };
    prospectingQuotaService = {
      assertCanConsume: jest.fn().mockResolvedValue({
        used: 0,
        quota: 150,
        remaining: 70,
      }),
    };

    useCase = new ExecuteProspectSearchUseCase(
      searchRepository,
      searchResultRepository,
      sourceRegistry,
      websiteEnricher,
      checkQuotaUseCase,
      recordUsageUseCase,
      prospectingQuotaService as any,
    );
  });

  it('should execute a pending search, persist results and complete it', async () => {
    const search = makePendingSearch();
    searchRepository.findBySearchId.mockResolvedValue(search);
    sourceRegistry.resolve.mockReturnValue({
      source: 'GOOGLE_PLACES',
      search: jest.fn().mockResolvedValue([
        {
          externalId: 'place-1',
          businessName: 'Clinica Sorriso',
          city: 'Campinas',
          state: 'SP',
          phone: '1933334444',
          website: 'https://clinicasorriso.com.br',
          email: 'contato@clinicasorriso.com.br',
        },
        {
          externalId: 'place-2',
          businessName: 'Odonto Centro',
          city: 'Campinas',
          state: 'SP',
          phone: '1935556666',
        },
      ]),
    } as any);
    websiteEnricher.enrich
      .mockResolvedValueOnce({
        email: 'contato@clinicasorriso.com.br',
        phone: '1933334444',
      })
      .mockResolvedValueOnce({});

    const output = await useCase.execute({
      searchId: search.id.toString(),
    });

    expect(searchRepository.save).toHaveBeenCalledTimes(2);
    expect(searchResultRepository.saveMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          businessName: 'Clinica Sorriso',
          city: 'Campinas',
          email: 'contato@clinicasorriso.com.br',
        }),
        expect.objectContaining({
          businessName: 'Odonto Centro',
          city: 'Campinas',
        }),
      ]),
    );
    expect(recordUsageUseCase.execute).toHaveBeenCalledWith({
      tenantId: search.tenantId.toString(),
      type: UsageType.AI_TOKEN,
      amount: 2,
    });
    expect(prospectingQuotaService.assertCanConsume).toHaveBeenCalledWith({
      tenantId: search.tenantId.toString(),
      requested: 80,
    });
    expect(output).toEqual({
      searchId: search.id.toString(),
      status: 'COMPLETED',
      discoveredCount: 2,
    });
  });

  it('should mark the search as failed when the source adapter throws', async () => {
    const search = makePendingSearch();
    searchRepository.findBySearchId.mockResolvedValue(search);
    sourceRegistry.resolve.mockReturnValue({
      source: 'GOOGLE_PLACES',
      search: jest.fn().mockRejectedValue(new Error('Provider unavailable')),
    } as any);

    const output = await useCase.execute({
      searchId: search.id.toString(),
    });

    expect(searchResultRepository.saveMany).not.toHaveBeenCalled();
    expect(searchRepository.save).toHaveBeenCalledTimes(2);
    expect(output).toEqual({
      searchId: search.id.toString(),
      status: 'FAILED',
      discoveredCount: 0,
    });
    expect(search.failureReason).toBe('Provider unavailable');
    expect(recordUsageUseCase.execute).not.toHaveBeenCalled();
  });

  it('should throw when the search does not exist', async () => {
    searchRepository.findBySearchId.mockResolvedValue(null);

    await expect(
      useCase.execute({
        searchId: 'missing-search',
      }),
    ).rejects.toThrow(EntityNotFoundException);
  });

  it('should keep the result even when website enrichment fails', async () => {
    const search = makePendingSearch();
    searchRepository.findBySearchId.mockResolvedValue(search);
    sourceRegistry.resolve.mockReturnValue({
      source: 'GOOGLE_PLACES',
      search: jest.fn().mockResolvedValue([
        {
          externalId: 'place-1',
          businessName: 'Clinica Sorriso',
          city: 'Campinas',
          state: 'SP',
          website: 'https://clinicasorriso.com.br',
        },
      ]),
    } as any);
    websiteEnricher.enrich.mockRejectedValue(new Error('Timeout'));

    const output = await useCase.execute({
      searchId: search.id.toString(),
    });

    expect(searchResultRepository.saveMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          businessName: 'Clinica Sorriso',
          website: 'https://clinicasorriso.com.br',
          email: undefined,
        }),
      ]),
    );
    expect(output).toEqual({
      searchId: search.id.toString(),
      status: 'COMPLETED',
      discoveredCount: 1,
    });
    expect(recordUsageUseCase.execute).toHaveBeenCalledWith({
      tenantId: search.tenantId.toString(),
      type: UsageType.AI_TOKEN,
      amount: 1,
    });
  });

  it('should fail early when the tenant has no AI tokens available', async () => {
    const search = makePendingSearch();
    searchRepository.findBySearchId.mockResolvedValue(search);
    checkQuotaUseCase.execute.mockResolvedValue({
      canProceed: false,
      used: 1000,
      quota: 1000,
      status: 'ACTIVE',
    });

    const output = await useCase.execute({
      searchId: search.id.toString(),
    });

    expect(sourceRegistry.resolve).not.toHaveBeenCalled();
    expect(prospectingQuotaService.assertCanConsume).not.toHaveBeenCalled();
    expect(searchResultRepository.saveMany).not.toHaveBeenCalled();
    expect(recordUsageUseCase.execute).not.toHaveBeenCalled();
    expect(output).toEqual({
      searchId: search.id.toString(),
      status: 'FAILED',
      discoveredCount: 0,
    });
    expect(search.failureReason).toBe(
      'AI token quota exceeded for prospect search',
    );
  });

  it('should fail before hitting the source when the daily prospecting quota is exceeded', async () => {
    const search = makePendingSearch();
    searchRepository.findBySearchId.mockResolvedValue(search);
    prospectingQuotaService.assertCanConsume.mockRejectedValue(
      new Error(
        'Limite diario de prospeccao atingido. Usado hoje: 150. Limite: 150.',
      ),
    );

    const output = await useCase.execute({
      searchId: search.id.toString(),
    });

    expect(sourceRegistry.resolve).not.toHaveBeenCalled();
    expect(searchResultRepository.saveMany).not.toHaveBeenCalled();
    expect(recordUsageUseCase.execute).not.toHaveBeenCalled();
    expect(output).toEqual({
      searchId: search.id.toString(),
      status: 'FAILED',
      discoveredCount: 0,
    });
    expect(search.failureReason).toContain('Limite diario de prospeccao');
  });
});
