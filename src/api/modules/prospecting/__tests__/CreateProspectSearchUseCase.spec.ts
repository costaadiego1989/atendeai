import { NotFoundException } from '@nestjs/common';
import { ITenantFacade } from '@modules/tenant/application/facades/ITenantFacade';
import { CreateProspectSearchUseCase } from '../application/use-cases/CreateProspectSearchUseCase';
import { IProspectSearchRepository } from '../domain/repositories/IProspectSearchRepository';
import { IProspectSearchQueue } from '../domain/ports/IProspectSearchQueue';
import { IProspectingDailyQuotaPort } from '../application/ports/IProspectingDailyQuotaPort';

const TENANT_ID = 'f0e9c8b0-4f78-4a1c-bb62-1d67ad55a111';

describe('CreateProspectSearchUseCase', () => {
  let useCase: CreateProspectSearchUseCase;
  let tenantFacade: jest.Mocked<Pick<ITenantFacade, 'tenantExists'>>;
  let searchRepository: jest.Mocked<IProspectSearchRepository>;
  let searchQueue: jest.Mocked<IProspectSearchQueue>;
  let prospectingQuotaPort: jest.Mocked<IProspectingDailyQuotaPort>;

  beforeEach(() => {
    tenantFacade = {
      tenantExists: jest.fn().mockResolvedValue(true),
    };

    searchRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findBySearchId: jest.fn(),
      findAllByTenant: jest.fn(),
    };

    searchQueue = {
      addJob: jest.fn(),
    };
    prospectingQuotaPort = {
      assertCanConsume: jest.fn().mockResolvedValue({
        used: 0,
        quota: 150,
        remaining: 70,
      }),
    };

    useCase = new CreateProspectSearchUseCase(
      tenantFacade as any,
      searchRepository,
      searchQueue,
      prospectingQuotaPort,
    );
  });

  it('should throw when the tenant does not exist', async () => {
    tenantFacade.tenantExists.mockResolvedValue(false);

    await expect(
      useCase.execute({
        tenantId: 'missing-tenant',
        businessTypeQuery: 'Clinica odontologica',
        city: 'Campinas',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should create a pending prospect search and enqueue it', async () => {
    const result = await useCase.execute({
      tenantId: TENANT_ID,
      businessTypeQuery: 'Clinica odontologica',
      city: 'Campinas',
      state: 'SP',
      maxResults: 80,
    });

    expect(searchRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        businessTypeQuery: 'Clinica odontologica',
        city: 'Campinas',
        state: 'SP',
        maxResults: 80,
        discoveredCount: 0,
      }),
    );
    expect(searchQueue.addJob).toHaveBeenCalledWith({
      searchId: result.id,
    });
    expect(prospectingQuotaPort.assertCanConsume).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      requested: 80,
    });
    expect(result).toEqual(
      expect.objectContaining({
        tenantId: TENANT_ID,
        businessTypeQuery: 'Clinica odontologica',
        city: 'Campinas',
        state: 'SP',
        source: 'GOOGLE_PLACES',
        maxResults: 80,
        status: 'PENDING',
        discoveredCount: 0,
      }),
    );
  });

  it('should apply defaults when optional fields are omitted', async () => {
    const result = await useCase.execute({
      tenantId: TENANT_ID,
      businessTypeQuery: 'Academia',
      city: 'Sao Paulo',
    });

    expect(result.source).toBe('GOOGLE_PLACES');
    expect(result.maxResults).toBe(50);
    expect(searchQueue.addJob).toHaveBeenCalledTimes(1);
  });

  it('should return the quota error before saving or enqueueing when daily prospecting limit is exceeded', async () => {
    prospectingQuotaPort.assertCanConsume.mockRejectedValue(
      new Error(
        'Limite diario de prospeccao atingido. Usado hoje: 150. Limite: 150.',
      ),
    );

    await expect(
      useCase.execute({
        tenantId: TENANT_ID,
        businessTypeQuery: 'Clinica odontologica',
        city: 'Campinas',
        maxResults: 80,
      }),
    ).rejects.toThrow('Limite diario de prospeccao atingido');

    expect(searchRepository.save).not.toHaveBeenCalled();
    expect(searchQueue.addJob).not.toHaveBeenCalled();
  });
});
