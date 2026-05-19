import { ProspectSelectedSearchResultsUseCase } from '../application/use-cases/ProspectSelectedSearchResultsUseCase';
import { IProspectSearchRepository } from '../domain/repositories/IProspectSearchRepository';
import { IProspectSearchResultRepository } from '../domain/repositories/IProspectSearchResultRepository';
import { IProspectCampaignRepository } from '../domain/repositories/IProspectCampaignRepository';
import { ProspectSearch } from '../domain/entities/ProspectSearch';
import { ProspectSearchResult } from '../domain/entities/ProspectSearchResult';
import { ProspectSearchSourceVO } from '../domain/value-objects/ProspectSearchSource';
import { TenantId } from '@shared/domain/TenantId';
import { IContactFacade } from '@modules/contact/application/facades/ContactFacade';
import { ProspectDispatchPolicy } from '../application/services/ProspectDispatchPolicy';

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

describe('ProspectSelectedSearchResultsUseCase', () => {
  let useCase: ProspectSelectedSearchResultsUseCase;
  let searchRepository: jest.Mocked<IProspectSearchRepository>;
  let searchResultRepository: jest.Mocked<IProspectSearchResultRepository>;
  let contactFacade: jest.Mocked<IContactFacade>;
  let campaignRepository: jest.Mocked<IProspectCampaignRepository>;

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
    contactFacade = {
      identifyContact: jest.fn(),
      getContactById: jest.fn(),
      ensureContact: jest.fn(),
      upsertProspectContact: jest.fn(),
      findContactIdsForReengagementAudience: jest.fn(),
      markProspectingOptOut: jest.fn(),
    };
    campaignRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findAllByTenant: jest.fn(),
    };
    useCase = new ProspectSelectedSearchResultsUseCase(
      searchRepository,
      searchResultRepository,
      contactFacade,
      campaignRepository,
      new ProspectDispatchPolicy({} as any),
    );
  });

  it('should create/import selected contacts and prepare a manual outreach queue', async () => {
    const search = makeSearch();
    const selectedA = ProspectSearchResult.create({
      tenantId: search.tenantId,
      searchId: search.id,
      source: search.source,
      externalId: 'place-1',
      businessName: 'Clinica Sorriso',
      city: 'Campinas',
      state: 'SP',
      phone: '(19) 3333-4444',
      email: 'contato@clinicasorriso.com.br',
    });
    const selectedB = ProspectSearchResult.create({
      tenantId: search.tenantId,
      searchId: search.id,
      source: search.source,
      externalId: 'place-2',
      businessName: 'Odonto Centro',
      city: 'Campinas',
      phone: '(19) 3555-6666',
    });

    searchRepository.findById.mockResolvedValue(search);
    searchResultRepository.findAllBySearch.mockResolvedValue([
      selectedA,
      selectedB,
    ]);
    contactFacade.upsertProspectContact
      .mockResolvedValueOnce({ contactId: 'contact-new', created: true })
      .mockResolvedValueOnce({ contactId: 'contact-existing', created: false });

    const result = await useCase.execute({
      tenantId: search.tenantId.toString(),
      searchId: search.id.toString(),
      resultIds: [selectedA.id.toString(), selectedB.id.toString()],
      messageTemplate: 'Oi {{first_name}}, tudo bem?',
      channel: 'WHATSAPP',
    });

    expect(contactFacade.upsertProspectContact).toHaveBeenCalledTimes(2);
    expect(campaignRepository.save).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      expect.objectContaining({
        importedCount: 1,
        reusedExistingContacts: 1,
        dispatchedExecutions: 0,
        skippedMissingPhone: 0,
      }),
    );
  });

  it('should create a dispatchable campaign when direct first message mode is requested', async () => {
    const search = makeSearch();
    const selected = ProspectSearchResult.create({
      tenantId: search.tenantId,
      searchId: search.id,
      source: search.source,
      externalId: 'place-1',
      businessName: 'Clinica Sorriso',
      city: 'Campinas',
      state: 'SP',
      phone: '(19) 3333-4444',
    });

    searchRepository.findById.mockResolvedValue(search);
    searchResultRepository.findAllBySearch.mockResolvedValue([selected]);
    contactFacade.upsertProspectContact.mockResolvedValue({
      contactId: 'contact-new',
      created: true,
    });

    await useCase.execute({
      tenantId: search.tenantId.toString(),
      searchId: search.id.toString(),
      resultIds: [selected.id.toString()],
      messageTemplate: 'Oi {{first_name}}, tudo bem?',
      channel: 'WHATSAPP',
      dispatchMode: 'DIRECT_FIRST_MESSAGE',
    });

    const savedCampaign = campaignRepository.save.mock.calls[0][0];

    expect(savedCampaign.objective).not.toContain(
      'Abordagem assistida de prospec',
    );
  });
});
