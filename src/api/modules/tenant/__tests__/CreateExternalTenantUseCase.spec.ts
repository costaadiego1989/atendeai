import { ConflictException } from '@nestjs/common';
import { CreateExternalTenantUseCase } from '../application/use-cases/CreateExternalTenantUseCase';
import { ITenantRepository } from '../domain/repositories/ITenantRepository';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';

describe('CreateExternalTenantUseCase', () => {
  let useCase: CreateExternalTenantUseCase;
  let tenantRepository: jest.Mocked<ITenantRepository>;

  beforeEach(() => {
    tenantRepository = {
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

    useCase = new CreateExternalTenantUseCase(tenantRepository);
  });

  it('should create a tenant with an owner and return its apiKey', async () => {
    tenantRepository.exists.mockResolvedValue(false);

    const result = await useCase.execute({
      companyName: 'External Corp',
      cnpj: '60.701.190/0001-04',
      ownerName: 'Owner Name',
      ownerEmail: 'owner@external.com',
      ownerPhone: '11999998888',
    });

    expect(tenantRepository.save).toHaveBeenCalledTimes(1);
    const savedTenant = tenantRepository.save.mock.calls[0][0];
    expect(savedTenant.owner?.email.value).toBe('owner@external.com');
    expect(savedTenant.owner?.role.value).toBe('OWNER');
    expect(savedTenant.owner?.passwordHash).toBe('external-provider-password');
    expect(result.apiKey).toBe(savedTenant.apiKey);
  });

  it('should throw when the tenant CNPJ already exists', async () => {
    tenantRepository.exists.mockResolvedValue(true);

    await expect(
      useCase.execute({
        companyName: 'External Corp',
        cnpj: '60.701.190/0001-04',
        ownerName: 'Owner Name',
        ownerEmail: 'owner@external.com',
        ownerPhone: '11999998888',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should bubble up invalid input from value objects', async () => {
    tenantRepository.exists.mockResolvedValue(false);

    await expect(
      useCase.execute({
        companyName: 'E',
        cnpj: '123',
        ownerName: 'Ow',
        ownerEmail: 'invalid-email',
        ownerPhone: '123',
      }),
    ).rejects.toThrow(ValidationErrorException);
  });
});
