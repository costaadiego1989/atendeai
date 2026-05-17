import { CreateTenantUseCase } from '../application/use-cases/CreateTenantUseCase';
import { ITenantRepository } from '../domain/repositories/ITenantRepository';
import { IPasswordHasher } from '@shared/application/ports/IPasswordHasher';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import { TenantDomainEventPublisher } from '../application/services/TenantDomainEventPublisher';

describe('CreateTenantUseCase', () => {
  let useCase: CreateTenantUseCase;
  let tenantRepo: jest.Mocked<ITenantRepository>;
  let passwordHasher: jest.Mocked<IPasswordHasher>;
  let tenantDomainEventPublisher: jest.Mocked<TenantDomainEventPublisher>;

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

    passwordHasher = {
      hash: jest.fn(),
      compare: jest.fn(),
    };

    tenantDomainEventPublisher = {
      publishFromAggregate: jest.fn(),
    } as unknown as jest.Mocked<TenantDomainEventPublisher>;

    useCase = new CreateTenantUseCase(
      tenantRepo,
      passwordHasher,
      tenantDomainEventPublisher,
    );
  });

  it('should create a tenant with default TRIAL plan and owner user', async () => {
    tenantRepo.exists.mockResolvedValue(false);
    passwordHasher.hash.mockResolvedValue('hashed-password');

    const result = await useCase.execute({
      companyName: 'Acme Corp',
      cnpj: '60.701.190/0001-04',
      ownerName: 'Owner Name',
      ownerCpf: '529.982.247-25',
      ownerEmail: 'owner@acme.com',
      ownerPhone: '11999998888',
      ownerPassword: 'Password123!',
    });

    expect(passwordHasher.hash).toHaveBeenCalledWith('Password123!');
    expect(tenantRepo.save).toHaveBeenCalledTimes(1);
    expect(
      tenantDomainEventPublisher.publishFromAggregate,
    ).toHaveBeenCalledTimes(1);

    const savedTenant = tenantRepo.save.mock.calls[0][0];
    expect(savedTenant.plan.value).toBe('TRIAL');
    expect(savedTenant.owner?.name).toBe('Owner Name');
    expect(savedTenant.owner?.email.value).toBe('owner@acme.com');
    expect(savedTenant.owner?.cpf?.value).toBe('529.982.247-25');
    expect(savedTenant.owner?.role.value).toBe('OWNER');
    expect(savedTenant.owner?.passwordHash).toBe('hashed-password');

    expect(result.companyName).toBe('Acme Corp');
    expect(result.plan).toBe('TRIAL');
    expect(result.owner.name).toBe('Owner Name');
    expect(result.owner.email).toBe('owner@acme.com');
  });

  it('should use the provided plan when explicitly informed', async () => {
    tenantRepo.exists.mockResolvedValue(false);
    passwordHasher.hash.mockResolvedValue('hashed-password');

    const result = await useCase.execute({
      companyName: 'Acme Corp',
      cnpj: '11.222.333/0001-81',
      ownerName: 'Owner Name',
      ownerEmail: 'owner2@acme.com',
      ownerPhone: '11999997777',
      ownerPassword: 'Password123!',
      plan: 'PROFISSIONAL',
    });

    expect(result.plan).toBe('PROFISSIONAL');
    const savedTenant = tenantRepo.save.mock.calls[0][0];
    expect(savedTenant.plan.value).toBe('PROFISSIONAL');
  });

  it('should throw when CNPJ is already registered', async () => {
    tenantRepo.exists.mockResolvedValue(true);

    await expect(
      useCase.execute({
        companyName: 'Acme Corp',
        cnpj: '60.701.190/0001-04',
        ownerName: 'Owner Name',
        ownerEmail: 'owner@acme.com',
        ownerPhone: '11999998888',
        ownerPassword: 'Password123!',
      }),
    ).rejects.toThrow(ValidationErrorException);

    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(tenantRepo.save).not.toHaveBeenCalled();
    expect(
      tenantDomainEventPublisher.publishFromAggregate,
    ).not.toHaveBeenCalled();
  });
});
