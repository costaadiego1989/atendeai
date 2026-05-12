import { GetCurrentUserUseCase } from '../GetCurrentUserUseCase';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import { AuthUser } from '../../../domain/entities/AuthUser';
import { AuthUserEmail } from '../../../domain/value-objects/AuthUserEmail';
import { Role } from '@shared/domain/Role';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';

describe('GetCurrentUserUseCase', () => {
  let useCase: GetCurrentUserUseCase;
  let authUserRepo: any;
  let tenantModuleAccessService: any;

  const mockBillingAccess = {
    subscriptionId: 'sub-1',
    plan: 'PRO',
    status: 'ACTIVE',
    pricing: {
      baseMonthlyPrice: 99,
      addonsMonthlyPrice: 0,
      totalMonthlyPrice: 99,
      pricingVersion: 'v1',
    },
    includedModules: ['messaging'],
    addonModules: [],
    enabledModules: ['messaging'],
    moduleAccess: { messaging: true },
  };

  function createMockUser(overrides: Partial<{
    id: string;
    tenantId: string;
    tenantName: string;
    tenantCnpj: string;
    tenantBusinessType: string;
    tenantBranches: Array<{ id: string; name: string; isHeadquarters: boolean; active: boolean }>;
    email: string;
    name: string;
    phone: string;
    cpf: string;
    role: string;
    mustChangePassword: boolean;
    planStatus: string;
  }> = {}) {
    return AuthUser.create(
      {
        tenantId: overrides.tenantId ?? 'tenant-123',
        tenantName: overrides.tenantName ?? 'Tenant Test',
        tenantCnpj: overrides.tenantCnpj ?? '12345678000100',
        tenantBusinessType: overrides.tenantBusinessType ?? 'SCHEDULING',
        tenantBranches: overrides.tenantBranches ?? [
          { id: 'branch-1', name: 'Matriz', isHeadquarters: true, active: true },
          { id: 'branch-2', name: 'Filial', isHeadquarters: false, active: false },
        ],
        email: AuthUserEmail.create(overrides.email ?? 'test@test.com'),
        name: overrides.name ?? 'Test User',
        phone: overrides.phone,
        cpf: overrides.cpf,
        passwordHash: 'hashed',
        role: Role.create(overrides.role ?? 'ADMIN'),
        mustChangePassword: overrides.mustChangePassword ?? false,
        planStatus: overrides.planStatus ?? 'ACTIVE',
        tenantCreatedAt: new Date('2025-01-01'),
      },
      new UniqueEntityID(overrides.id ?? 'user-123'),
    );
  }

  beforeEach(() => {
    authUserRepo = { findById: jest.fn() };
    tenantModuleAccessService = {
      getSummary: jest.fn().mockResolvedValue(mockBillingAccess),
    };
    useCase = new GetCurrentUserUseCase(authUserRepo, tenantModuleAccessService);
  });

  it('should return user and tenant when user exists', async () => {
    const mockUser = createMockUser();
    authUserRepo.findById.mockResolvedValue(mockUser);

    const result = await useCase.execute('user-123');

    expect(result.user.id).toBe('user-123');
    expect(result.user.name).toBe('Test User');
    expect(result.user.email).toBe('test@test.com');
    expect(result.user.tenantId).toBe('tenant-123');
    expect(result.user.role).toBe('ADMIN');
    expect(result.tenant.id).toBe('tenant-123');
    expect(result.tenant.name).toBe('Tenant Test');
    expect(authUserRepo.findById).toHaveBeenCalledWith('user-123');
  });

  it('should throw EntityNotFoundException when user does not exist', async () => {
    authUserRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('invalid-id')).rejects.toThrow(
      EntityNotFoundException,
    );
  });

  it('should include billingAccess in response', async () => {
    const mockUser = createMockUser();
    authUserRepo.findById.mockResolvedValue(mockUser);

    const result = await useCase.execute('user-123');

    expect(result.tenant.billingAccess).toEqual(mockBillingAccess);
    expect(tenantModuleAccessService.getSummary).toHaveBeenCalledWith('tenant-123');
  });

  it('should include tenant branches in response', async () => {
    const mockUser = createMockUser({
      tenantBranches: [
        { id: 'b1', name: 'Matriz', isHeadquarters: true, active: true },
        { id: 'b2', name: 'Filial', isHeadquarters: false, active: true },
        { id: 'b3', name: 'Inativa', isHeadquarters: false, active: false },
      ],
    });
    authUserRepo.findById.mockResolvedValue(mockUser);

    const result = await useCase.execute('user-123');

    expect(result.tenant.branches).toHaveLength(3);
    expect(result.user.accessibleBranchIds).toEqual(['b1', 'b2']);
  });

  it('should return current mustChangePassword value', async () => {
    const mockUser = createMockUser({ mustChangePassword: true });
    authUserRepo.findById.mockResolvedValue(mockUser);

    const result = await useCase.execute('user-123');

    expect(result.user.mustChangePassword).toBe(true);
  });
});
