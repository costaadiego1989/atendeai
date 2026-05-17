import { ConfigureAIUseCase } from '../application/use-cases/ConfigureAIUseCase';
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
import { TenantAuditService } from '../application/services/TenantAuditService';

describe('ConfigureAIUseCase', () => {
  let useCase: ConfigureAIUseCase;
  let tenantRepo: jest.Mocked<ITenantRepository>;
  let tenantDomainEventPublisher: jest.Mocked<TenantDomainEventPublisher>;
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
    tenantAuditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<TenantAuditService>;

    useCase = new ConfigureAIUseCase(
      tenantRepo,
      tenantDomainEventPublisher,
      tenantAuditService,
    );
  });

  function makeTenant() {
    return Tenant.create({
      companyName: CompanyName.create('Acme Corp'),
      cnpj: CNPJ.create('11.222.333/0001-81'),
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
        systemPrompt: 'Prompt grande o suficiente',
        tone: 'FRIENDLY',
      }),
    ).rejects.toThrow(EntityNotFoundException);
  });

  it('should use defaults and persist the AI config', async () => {
    const tenant = makeTenant();
    tenant.clearEvents();
    tenantRepo.findById.mockResolvedValue(tenant);

    const result = await useCase.execute({
      tenantId: tenant.id.toValue(),
      systemPrompt: 'Prompt grande o suficiente',
      tone: 'FRIENDLY',
    });

    expect(tenant.aiConfig).not.toBeNull();
    expect(tenant.aiConfig?.language).toBe('pt-BR');
    expect(tenant.aiConfig?.maxTokensPerResponse).toBe(500);
    expect(tenant.aiConfig?.confidenceThreshold).toBe(0.7);
    expect(tenantRepo.save).toHaveBeenCalledWith(tenant);
    expect(
      tenantDomainEventPublisher.publishFromAggregate,
    ).toHaveBeenCalledWith(tenant);
    expect(result).toEqual(
      expect.objectContaining({
        systemPrompt: 'Prompt grande o suficiente',
        tone: 'FRIENDLY',
      }),
    );
  });
});
