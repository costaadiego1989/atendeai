import { ConfigureInstagramUseCase } from '../application/use-cases/ConfigureInstagramUseCase';
import { ITenantRepository } from '../domain/repositories/ITenantRepository';
import { TenantDomainEventPublisher } from '../application/services/TenantDomainEventPublisher';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import { Tenant } from '../domain/entities/Tenant';
import { CompanyName } from '../domain/value-objects/CompanyName';
import { CNPJ } from '../domain/value-objects/CNPJ';
import { Plan } from '../domain/value-objects/Plan';
import { User } from '../domain/entities/User';
import { Email } from '../domain/value-objects/Email';
import { Phone } from '../domain/value-objects/Phone';
import { Role } from '../domain/value-objects/Role';
import { ConfigService } from '@nestjs/config';
import { TenantAuditService } from '../application/services/TenantAuditService';
import { TenantBranch } from '../domain/entities/TenantBranch';
import { Address } from '../domain/value-objects/Address';

describe('ConfigureInstagramUseCase', () => {
  let useCase: ConfigureInstagramUseCase;
  let tenantRepo: jest.Mocked<ITenantRepository>;
  let tenantDomainEventPublisher: jest.Mocked<TenantDomainEventPublisher>;
  let configService: jest.Mocked<ConfigService>;
  let tenantAuditService: jest.Mocked<TenantAuditService>;

  beforeEach(() => {
    tenantRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findByCnpj: jest.fn(),
      findByWhatsAppNumber: jest.fn(),
      findByApiKey: jest.fn(),
      findAll: jest.fn(),
      listBranches: jest.fn().mockResolvedValue([]),
      createBranch: jest.fn(),
      updateBranch: jest.fn(),
      deleteBranch: jest.fn(),
      exists: jest.fn(),
    };

    tenantDomainEventPublisher = {
      publishFromAggregate: jest.fn(),
    } as unknown as jest.Mocked<TenantDomainEventPublisher>;
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'META_ACCESS_TOKEN') return 'meta-platform-token';
        if (key === 'META_WEBHOOK_SECRET') return 'meta-platform-secret';
        return undefined;
      }),
    } as any;
    tenantAuditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<TenantAuditService>;

    useCase = new ConfigureInstagramUseCase(
      tenantRepo,
      tenantDomainEventPublisher,
      configService,
      tenantAuditService,
    );
  });

  function makeTenant() {
    return Tenant.create({
      companyName: CompanyName.create('Acme Corp'),
      cnpj: CNPJ.create('60.701.190/0001-04'),
      plan: Plan.create('ESSENCIAL'),
      users: [
        User.create({
          name: 'Owner Name',
          email: Email.create('owner@acme.com'),
          phone: Phone.create('11999998888'),
          passwordHash: 'hashed-password',
          role: Role.create('OWNER'),
        }),
      ],
    });
  }

  it('should throw when the tenant does not exist', async () => {
    tenantRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        tenantId: 'missing-tenant',
        instagramAccountId: 'ig-account',
      }),
    ).rejects.toThrow(EntityNotFoundException);

    expect(tenantRepo.save).not.toHaveBeenCalled();
    expect(
      tenantDomainEventPublisher.publishFromAggregate,
    ).not.toHaveBeenCalled();
  });

  it('should persist the instagram config', async () => {
    const tenant = makeTenant();
    tenant.clearEvents();
    tenantRepo.findById.mockResolvedValue(tenant);

    const result = await useCase.execute({
      tenantId: tenant.id.toValue(),
      instagramAccountId: '17841400000000000',
    });

    expect(tenantRepo.save).toHaveBeenCalledWith(tenant);
    expect(
      tenantDomainEventPublisher.publishFromAggregate,
    ).toHaveBeenCalledWith(tenant);
    expect(result).toEqual(
      expect.objectContaining({
        instagramAccountId: '17841400000000000',
        status: 'ACTIVE',
      }),
    );
    expect(tenant.instagramConfig?.metaAccessToken).toBe('meta-platform-token');
    expect(
      tenant.domainEvents.map((event) => event.constructor.name),
    ).toContain('InstagramConfigured');
  });

  it('should persist instagram config in a branch scope when branchId is provided', async () => {
    const tenant = makeTenant();
    const branch = TenantBranch.create({
      tenantId: tenant.id.toValue(),
      name: 'Filial Praia',
      cnpj: null,
      phone: null,
      email: null,
      whatsappNumber: null,
      instagramAccountId: null,
      whatsAppConfigOverride: null,
      address: Address.create({
        zipcode: '22000-000',
        street: 'Rua C',
        streetNumber: '3',
        neighborhood: 'Centro',
        city: 'Rio de Janeiro',
        state: 'RJ',
      }),
      operatingHours: null,
      isHeadquarters: false,
      active: true,
    });

    tenantRepo.findById.mockResolvedValue(tenant);
    tenantRepo.listBranches.mockResolvedValue([branch]);

    const result = await useCase.execute({
      tenantId: tenant.id.toValue(),
      branchId: branch.id.toValue(),
      instagramAccountId: '17841499999999999',
    });

    expect(tenantRepo.updateBranch).toHaveBeenCalledWith(
      branch.id.toValue(),
      expect.objectContaining({
        instagramAccountId: '17841499999999999',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: branch.id.toValue(),
        instagramAccountId: '17841499999999999',
        status: 'ACTIVE',
      }),
    );
  });
});
