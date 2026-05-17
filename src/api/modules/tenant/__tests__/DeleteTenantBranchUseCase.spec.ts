import { DeleteTenantBranchUseCase } from '../application/use-cases/DeleteTenantBranchUseCase.js';
import { ITenantRepository } from '../domain/repositories/ITenantRepository.js';
import { TenantAuditService } from '../application/services/TenantAuditService.js';

describe('DeleteTenantBranchUseCase', () => {
  let useCase: DeleteTenantBranchUseCase;
  let tenantRepository: jest.Mocked<ITenantRepository>;
  let tenantAuditService: jest.Mocked<TenantAuditService>;

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

    useCase = new DeleteTenantBranchUseCase(
      tenantRepository,
      tenantAuditService,
    );
  });

  it('should delete a branch and record audit log', async () => {
    const input = {
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      requestingUserId: 'user-1',
      requestingUserEmail: 'user@example.com',
    };

    await useCase.execute(input);

    expect(tenantRepository.deleteBranch).toHaveBeenCalledWith(
      input.tenantId,
      input.branchId,
    );

    expect(tenantAuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        eventType: 'BRANCH_DELETED',
        metadata: expect.objectContaining({
          branchId: 'branch-1',
        }),
      }),
    );
  });
});
