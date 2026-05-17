import { UpdateTenantPlanStatusUseCase } from '../application/use-cases/UpdateTenantPlanStatusUseCase.js';
import { ITenantRepository } from '../domain/repositories/ITenantRepository.js';
import { Tenant } from '../domain/entities/Tenant.js';
import { CompanyName } from '../domain/value-objects/CompanyName.js';
import { CNPJ } from '../domain/value-objects/CNPJ.js';
import { Plan } from '../domain/value-objects/Plan.js';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';

describe('UpdateTenantPlanStatusUseCase', () => {
  let useCase: UpdateTenantPlanStatusUseCase;
  let tenantRepo: jest.Mocked<ITenantRepository>;

  beforeEach(() => {
    tenantRepo = {
      findById: jest.fn(),
      save: jest.fn(),
      findAll: jest.fn(),
      findByCnpj: jest.fn(),
      findByWhatsAppNumber: jest.fn(),
      findByApiKey: jest.fn(),
      exists: jest.fn(),
      createBranch: jest.fn(),
      listBranches: jest.fn(),
      updateBranch: jest.fn(),
      deleteBranch: jest.fn(),
    };

    useCase = new UpdateTenantPlanStatusUseCase(tenantRepo);
  });

  it('should update plan status and save the tenant', async () => {
    const tenant = Tenant.create({
      companyName: CompanyName.create('Acme Corp'),
      cnpj: CNPJ.create('12345678000195'),
      plan: Plan.create('ESSENCIAL'),
      users: [],
    });

    tenantRepo.findById.mockResolvedValue(tenant);

    await useCase.execute({
      tenantId: 'tenant-1',
      status: 'EXPIRED',
    });

    expect(tenant.planStatus).toBe('EXPIRED');
    expect(tenantRepo.save).toHaveBeenCalledWith(tenant);
  });

  it('should throw EntityNotFoundException if tenant does not exist', async () => {
    tenantRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        tenantId: 'missing',
        status: 'ACTIVE',
      }),
    ).rejects.toThrow(EntityNotFoundException);
  });
});
