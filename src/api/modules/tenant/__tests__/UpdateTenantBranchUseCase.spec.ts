import { UpdateTenantBranchUseCase } from '../application/use-cases/UpdateTenantBranchUseCase.js';
import { ITenantRepository } from '../domain/repositories/ITenantRepository.js';
import { TenantAuditService } from '../application/services/TenantAuditService.js';
import { TenantBranch } from '../domain/entities/TenantBranch.js';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';

describe('UpdateTenantBranchUseCase', () => {
  let useCase: UpdateTenantBranchUseCase;
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

    useCase = new UpdateTenantBranchUseCase(
      tenantRepository,
      tenantAuditService,
      billingCapacityService as any,
    );
  });

  it('should update a branch and record audit log', async () => {
    const updateInput = {
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      name: 'Loja Centro Atualizada',
      cnpj: '12345678000195',
      isHeadquarters: true,
      active: true,
      requestingUserId: 'user-1',
      requestingUserEmail: 'user@example.com',
    };

    const branch = TenantBranch.create(
      {
        tenantId: updateInput.tenantId,
        name: updateInput.name,
        cnpj: updateInput.cnpj,
        isHeadquarters: updateInput.isHeadquarters,
        active: updateInput.active,
        phone: null,
        email: null,
        whatsappNumber: null,
        instagramAccountId: null,
        whatsAppConfigOverride: null,
        address: null,
        operatingHours: null,
      },
      new UniqueEntityID(updateInput.branchId),
    );

    tenantRepository.updateBranch.mockResolvedValue(branch);
    tenantRepository.listBranches.mockResolvedValue([branch]);

    const result = await useCase.execute(updateInput);

    expect(tenantRepository.updateBranch).toHaveBeenCalledWith(updateInput.branchId, expect.objectContaining({
      name: updateInput.name,
      cnpj: updateInput.cnpj,
      isHeadquarters: updateInput.isHeadquarters,
    }));

    expect(tenantAuditService.record).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      eventType: 'BRANCH_UPDATED',
      metadata: expect.objectContaining({
        branchId: 'branch-1',
        branchName: 'Loja Centro Atualizada',
      }),
    }));

    expect(result.success).toBe(true);
    expect(result.data.id).toBe('branch-1');
  });
});
