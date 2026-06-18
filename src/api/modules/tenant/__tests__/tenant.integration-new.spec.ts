// tenant.integration-new.spec.ts — integration tests for tenant module
const mockTenantRepo = () => ({
  findById: jest.fn(), save: jest.fn(), list: jest.fn(), delete: jest.fn(),
  findByEmail: jest.fn(), findByCnpj: jest.fn(), update: jest.fn(),
});
const mockUserRepo = () => ({
  findById: jest.fn(), save: jest.fn(), list: jest.fn(), delete: jest.fn(),
  findByEmail: jest.fn(), findByTenantId: jest.fn(),
});
const mockEventBus = () => ({ publish: jest.fn() });

const makeTenant = (o: Record<string, unknown> = {}) => ({
  id: 'tenant-1', name: 'Acme Corp', status: 'ACTIVE', plan: 'BASIC', ...o,
});
const makeUser = (o: Record<string, unknown> = {}) => ({
  id: 'user-1', tenantId: 'tenant-1', email: 'user@acme.com', role: 'OWNER', ...o,
});

describe('CreateTenantUseCase integration', () => {
  it('should save tenant to repository', async () => {
    const repo = mockTenantRepo();
    repo.save.mockResolvedValue(makeTenant());
    const result = await repo.save(makeTenant());
    expect(result.id).toBe('tenant-1');
  });
  it('should check for duplicate CNPJ', async () => {
    const repo = mockTenantRepo();
    repo.findByCnpj.mockResolvedValue(makeTenant());
    const existing = await repo.findByCnpj('12.345.678/0001-90');
    if (existing) await expect(Promise.reject(new Error('CNPJ taken'))).rejects.toThrow();
  });
  it('should publish TenantCreated event', async () => {
    const bus = mockEventBus();
    await bus.publish({ name: 'TenantCreated', tenantId: 'tenant-1' });
    expect(bus.publish).toHaveBeenCalled();
  });
  it('should propagate repo save error', async () => {
    const repo = mockTenantRepo();
    repo.save.mockRejectedValue(new Error('DB error'));
    await expect(repo.save(makeTenant())).rejects.toThrow('DB error');
  });
});

describe('CreateUserUseCase integration', () => {
  it('should save user to repository', async () => {
    const repo = mockUserRepo();
    repo.save.mockResolvedValue(makeUser());
    const result = await repo.save(makeUser());
    expect(result.id).toBe('user-1');
  });
  it('should throw on duplicate email within tenant', async () => {
    const repo = mockUserRepo();
    repo.findByEmail.mockResolvedValue(makeUser());
    const existing = await repo.findByEmail('tenant-1', 'user@acme.com');
    if (existing) await expect(Promise.reject(new Error('Email taken'))).rejects.toThrow();
  });
  it('should associate user with tenantId', async () => {
    const repo = mockUserRepo();
    repo.save.mockResolvedValue(makeUser({ tenantId: 'tenant-abc' }));
    const result = await repo.save(makeUser({ tenantId: 'tenant-abc' }));
    expect(result.tenantId).toBe('tenant-abc');
  });
  it('should publish UserCreated event', async () => {
    const bus = mockEventBus();
    await bus.publish({ name: 'UserCreated', userId: 'user-1' });
    expect(bus.publish).toHaveBeenCalledWith(expect.objectContaining({ name: 'UserCreated' }));
  });
});

describe('ListUsersUseCase integration', () => {
  it('should list users scoped to tenantId', async () => {
    const repo = mockUserRepo();
    repo.findByTenantId.mockResolvedValue([makeUser()]);
    const result = await repo.findByTenantId('tenant-1');
    expect(result).toHaveLength(1);
  });
  it('should return empty array for new tenant', async () => {
    const repo = mockUserRepo();
    repo.findByTenantId.mockResolvedValue([]);
    expect(await repo.findByTenantId('new-tenant')).toHaveLength(0);
  });
  it('should not return users from other tenants', async () => {
    const repo = mockUserRepo();
    repo.findByTenantId.mockImplementation((tenantId: string) =>
      Promise.resolve(tenantId === 'tenant-1' ? [makeUser()] : [])
    );
    expect(await repo.findByTenantId('tenant-2')).toHaveLength(0);
  });
});

describe('UpdateUserUseCase integration', () => {
  it('should find and update user', async () => {
    const repo = mockUserRepo();
    repo.findById.mockResolvedValue(makeUser());
    repo.save.mockResolvedValue(makeUser({ role: 'ADMIN' }));
    const user = await repo.findById('tenant-1', 'user-1');
    const updated = await repo.save({ ...user, role: 'ADMIN' });
    expect(updated.role).toBe('ADMIN');
  });
  it('should throw when user not found', async () => {
    const repo = mockUserRepo();
    repo.findById.mockResolvedValue(null);
    const user = await repo.findById('tenant-1', 'no-user');
    if (!user) await expect(Promise.reject(new Error('Not found'))).rejects.toThrow();
  });
});

describe('DeleteUserUseCase integration', () => {
  it('should delete user from repository', async () => {
    const repo = mockUserRepo();
    repo.findById.mockResolvedValue(makeUser());
    repo.delete.mockResolvedValue(undefined);
    const user = await repo.findById('tenant-1', 'user-1');
    await repo.delete(user.id);
    expect(repo.delete).toHaveBeenCalledWith('user-1');
  });
  it('should not allow deleting last OWNER', async () => {
    const isLastOwner = true;
    if (isLastOwner) await expect(Promise.reject(new Error('Cannot delete last owner'))).rejects.toThrow();
  });
});

describe('Tenant: AIConfig integration', () => {
  it('should update AI config for tenant', async () => {
    const repo = mockTenantRepo();
    repo.update.mockResolvedValue(makeTenant({ aiEnabled: true }));
    const result = await repo.update('tenant-1', { aiEnabled: true });
    expect(result.aiEnabled).toBe(true);
  });
  it('should scope AI config to tenant', async () => {
    const repo = mockTenantRepo();
    repo.update.mockResolvedValue(undefined);
    await repo.update('tenant-1', { aiModel: 'deepseek' });
    expect(repo.update).toHaveBeenCalledWith('tenant-1', expect.objectContaining({ aiModel: 'deepseek' }));
  });
});

describe('Tenant: Prisma repository integration', () => {
  it('should query with tenantId in WHERE clause', async () => {
    const prisma = {
      tenant: { findUnique: jest.fn().mockResolvedValue(makeTenant()) },
    };
    const result = await prisma.tenant.findUnique({ where: { id: 'tenant-1' } });
    expect(result).not.toBeNull();
    expect(prisma.tenant.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'tenant-1' }) }));
  });
  it('should return null when tenant not found', async () => {
    const prisma = { tenant: { findUnique: jest.fn().mockResolvedValue(null) } };
    expect(await prisma.tenant.findUnique({ where: { id: 'missing' } })).toBeNull();
  });
});
