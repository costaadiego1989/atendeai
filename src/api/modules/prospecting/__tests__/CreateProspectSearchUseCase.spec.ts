import { NotFoundException } from '@nestjs/common';
import { ITenantRepository } from '@modules/tenant/domain/repositories/ITenantRepository';
import { Tenant } from '@modules/tenant/domain/entities/Tenant';
import { User } from '@modules/tenant/domain/entities/User';
import { CompanyName } from '@modules/tenant/domain/value-objects/CompanyName';
import { CNPJ } from '@modules/tenant/domain/value-objects/CNPJ';
import { Plan } from '@modules/tenant/domain/value-objects/Plan';
import { Email } from '@modules/tenant/domain/value-objects/Email';
import { Phone } from '@modules/tenant/domain/value-objects/Phone';
import { Role } from '@modules/tenant/domain/value-objects/Role';
import { CreateProspectSearchUseCase } from '../application/use-cases/CreateProspectSearchUseCase';
import { IProspectSearchRepository } from '../domain/repositories/IProspectSearchRepository';
import { IProspectSearchQueue } from '../domain/ports/IProspectSearchQueue';
import { BillingProspectingQuotaService } from '@modules/billing/application/services/BillingProspectingQuotaService';

function makeTenant() {
  const tenant = Tenant.create({
    companyName: CompanyName.create('Prospect Search Store'),
    cnpj: CNPJ.create('60.701.190/0001-04'),
    plan: Plan.create('PROFISSIONAL'),
    users: [
      User.create({
        name: 'Owner Prospect Search',
        email: Email.create('owner@prospect-search.test'),
        phone: Phone.create('11999998888'),
        passwordHash: 'hash',
        role: Role.create('OWNER'),
      }),
    ],
  });
  tenant.clearEvents();
  return tenant;
}

describe('CreateProspectSearchUseCase', () => {
  let useCase: CreateProspectSearchUseCase;
  let tenantRepository: jest.Mocked<ITenantRepository>;
  let searchRepository: jest.Mocked<IProspectSearchRepository>;
  let searchQueue: jest.Mocked<IProspectSearchQueue>;
  let prospectingQuotaService: jest.Mocked<Pick<BillingProspectingQuotaService, 'assertCanConsume'>>;

  beforeEach(() => {
    tenantRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByCnpj: jest.fn(),
      findByWhatsAppNumber: jest.fn(),
      findByApiKey: jest.fn(),
      findAll: jest.fn(),
      exists: jest.fn(),
      listBranches: jest.fn(),
      createBranch: jest.fn(),
      updateBranch: jest.fn(),
      deleteBranch: jest.fn(),
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
    prospectingQuotaService = {
      assertCanConsume: jest.fn().mockResolvedValue({
        used: 0,
        quota: 150,
        remaining: 70,
      }),
    };

    useCase = new CreateProspectSearchUseCase(
      tenantRepository,
      searchRepository,
      searchQueue,
      prospectingQuotaService as any,
    );
  });

  it('should throw when the tenant does not exist', async () => {
    tenantRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        tenantId: 'missing-tenant',
        businessTypeQuery: 'Clinica odontologica',
        city: 'Campinas',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should create a pending prospect search and enqueue it', async () => {
    const tenant = makeTenant();
    tenantRepository.findById.mockResolvedValue(tenant);

    const result = await useCase.execute({
      tenantId: tenant.id.toString(),
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
    expect(prospectingQuotaService.assertCanConsume).toHaveBeenCalledWith({
      tenantId: tenant.id.toString(),
      requested: 80,
    });
    expect(result).toEqual(
      expect.objectContaining({
        tenantId: tenant.id.toString(),
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
    const tenant = makeTenant();
    tenantRepository.findById.mockResolvedValue(tenant);

    const result = await useCase.execute({
      tenantId: tenant.id.toString(),
      businessTypeQuery: 'Academia',
      city: 'Sao Paulo',
    });

    expect(result.source).toBe('GOOGLE_PLACES');
    expect(result.maxResults).toBe(50);
    expect(searchQueue.addJob).toHaveBeenCalledTimes(1);
  });

  it('should return the quota error before saving or enqueueing when daily prospecting limit is exceeded', async () => {
    const tenant = makeTenant();
    tenantRepository.findById.mockResolvedValue(tenant);
    prospectingQuotaService.assertCanConsume.mockRejectedValue(
      new Error('Limite diario de prospeccao atingido. Usado hoje: 150. Limite: 150.'),
    );

    await expect(
      useCase.execute({
        tenantId: tenant.id.toString(),
        businessTypeQuery: 'Clinica odontologica',
        city: 'Campinas',
        maxResults: 80,
      }),
    ).rejects.toThrow('Limite diario de prospeccao atingido');

    expect(searchRepository.save).not.toHaveBeenCalled();
    expect(searchQueue.addJob).not.toHaveBeenCalled();
  });
});
