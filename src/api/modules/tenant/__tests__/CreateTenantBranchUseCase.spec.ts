import { CreateTenantBranchUseCase } from '../application/use-cases/CreateTenantBranchUseCase.js';
import { ITenantRepository } from '../domain/repositories/ITenantRepository.js';
import { TenantAuditService } from '../application/services/TenantAuditService.js';
import { TenantBranch } from '../domain/entities/TenantBranch.js';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';

describe('CreateTenantBranchUseCase', () => {
  let useCase: CreateTenantBranchUseCase;
  let tenantRepository: jest.Mocked<ITenantRepository>;
  let tenantAuditService: jest.Mocked<TenantAuditService>;
  let billingCapacityService: { assertCanAdd: jest.Mock };

  beforeEach(() => {
    tenantRepository = {
      createBranch: jest.fn(),
      listBranches: jest.fn(),
      updateBranch: jest.fn(),
      deleteBranch: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      findByCnpj: jest.fn(),
      findByWhatsAppNumber: jest.fn(),
      findByApiKey: jest.fn(),
      findAll: jest.fn(),
      exists: jest.fn(),
    };

    tenantAuditService = {
      record: jest.fn(),
    } as any;

    billingCapacityService = {
      assertCanAdd: jest.fn(),
    };

    useCase = new CreateTenantBranchUseCase(
      tenantRepository,
      tenantAuditService,
      billingCapacityService as any,
    );
  });

  it('should create a branch and record audit log', async () => {
    const branchProps = {
      tenantId: 'tenant-1',
      name: 'Loja Centro',
      cnpj: '12345678000195',
      isHeadquarters: false,
      active: true,
    };

    const branch = TenantBranch.create(
      {
        ...branchProps,
        phone: null,
        email: null,
        whatsappNumber: null,
        instagramAccountId: null,
        whatsAppConfigOverride: null,
        address: null,
        operatingHours: null,
      },
      new UniqueEntityID('branch-1'),
    );

    tenantRepository.createBranch.mockResolvedValue(branch);

    const result = await useCase.execute({
      ...branchProps,
      requestingUserId: 'user-1',
      requestingUserEmail: 'user@example.com',
    });

    expect(tenantRepository.createBranch).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      name: 'Loja Centro',
    }));
    expect(billingCapacityService.assertCanAdd).toHaveBeenCalledWith(
      'tenant-1',
      'branches',
    );
    expect(tenantAuditService.record).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      eventType: 'BRANCH_ADDED',
      metadata: expect.objectContaining({
        branchId: 'branch-1',
        branchName: 'Loja Centro',
      }),
    }));
    expect(result.success).toBe(true);
    expect(result.data.id).toBe('branch-1');
  });
});
