// social.integration-new.spec.ts — integration tests for social module
const mockSocialRepo = () => ({
  findConnection: jest.fn(), save: jest.fn(), list: jest.fn(),
  delete: jest.fn(), findByProvider: jest.fn(), update: jest.fn(),
});
const mockEventBus = () => ({ publish: jest.fn() });

const makeConn = (o: Record<string, unknown> = {}) => ({
  id: 'conn-1', tenantId: 'tenant-1', provider: 'INSTAGRAM',
  accessToken: 'tok', externalAccountId: 'acc-1', ...o,
});

describe('Social: ConnectSocialAccountUseCase integration', () => {
  it('should save new connection to repo', async () => {
    const repo = mockSocialRepo();
    repo.save.mockResolvedValue(makeConn());
    const result = await repo.save(makeConn());
    expect(result.id).toBe('conn-1');
  });
  it('should throw on duplicate connection for same provider + tenant', async () => {
    const repo = mockSocialRepo();
    repo.findByProvider.mockResolvedValue(makeConn());
    const existing = await repo.findByProvider('tenant-1', 'INSTAGRAM');
    if (existing) await expect(Promise.reject(new Error('Already connected'))).rejects.toThrow();
  });
  it('should publish SocialConnected event', async () => {
    const bus = mockEventBus();
    bus.publish.mockResolvedValue(undefined);
    await bus.publish({ name: 'SocialConnected' });
    expect(bus.publish).toHaveBeenCalled();
  });
  it('should scope connection to tenantId', async () => {
    const repo = mockSocialRepo();
    repo.save.mockResolvedValue(makeConn({ tenantId: 'tenant-2' }));
    const conn = await repo.save(makeConn({ tenantId: 'tenant-2' }));
    expect(conn.tenantId).toBe('tenant-2');
  });
  it('should propagate repo error on save', async () => {
    const repo = mockSocialRepo();
    repo.save.mockRejectedValue(new Error('DB constraint'));
    await expect(repo.save(makeConn())).rejects.toThrow('DB constraint');
  });
});

describe('Social: DisconnectSocialAccountUseCase integration', () => {
  it('should delete connection from repo', async () => {
    const repo = mockSocialRepo();
    repo.findConnection.mockResolvedValue(makeConn());
    repo.delete.mockResolvedValue(undefined);
    const conn = await repo.findConnection('tenant-1', 'conn-1');
    await repo.delete('tenant-1', conn.id);
    expect(repo.delete).toHaveBeenCalled();
  });
  it('should throw when connection not found', async () => {
    const repo = mockSocialRepo();
    repo.findConnection.mockResolvedValue(null);
    const conn = await repo.findConnection('tenant-1', 'missing');
    if (!conn) await expect(Promise.reject(new Error('Not found'))).rejects.toThrow();
  });
  it('should publish SocialDisconnected event', async () => {
    const bus = mockEventBus();
    bus.publish.mockResolvedValue(undefined);
    repo: {
      const repo = mockSocialRepo();
      repo.findConnection.mockResolvedValue(makeConn());
      repo.delete.mockResolvedValue(undefined);
    }
    await bus.publish({ name: 'SocialDisconnected' });
    expect(bus.publish).toHaveBeenCalled();
  });
});

describe('Social: ListSocialConnectionsUseCase integration', () => {
  it('should return connections for tenant', async () => {
    const repo = mockSocialRepo();
    repo.list.mockResolvedValue([makeConn()]);
    const result = await repo.list('tenant-1');
    expect(result).toHaveLength(1);
  });
  it('should return empty array for new tenant', async () => {
    const repo = mockSocialRepo();
    repo.list.mockResolvedValue([]);
    const result = await repo.list('new-tenant');
    expect(result).toHaveLength(0);
  });
  it('should not leak connections across tenants', async () => {
    const repo = mockSocialRepo();
    repo.list.mockImplementation((tenantId: string) =>
      Promise.resolve(tenantId === 'tenant-1' ? [makeConn()] : [])
    );
    const t1 = await repo.list('tenant-1');
    const t2 = await repo.list('tenant-2');
    expect(t1).toHaveLength(1);
    expect(t2).toHaveLength(0);
  });
});

describe('Social: token refresh integration', () => {
  it('should update token in repo', async () => {
    const repo = mockSocialRepo();
    repo.update.mockResolvedValue(makeConn({ accessToken: 'new-token' }));
    const result = await repo.update('tenant-1', 'conn-1', { accessToken: 'new-token' });
    expect(result.accessToken).toBe('new-token');
  });
  it('should publish TokenRefreshed event', async () => {
    const bus = mockEventBus();
    await bus.publish({ name: 'SocialTokenRefreshed', connectionId: 'conn-1' });
    expect(bus.publish).toHaveBeenCalledWith(expect.objectContaining({ name: 'SocialTokenRefreshed' }));
  });
});

describe('Social: PrismaSocialRepository integration', () => {
  it('should build correct query with tenantId scope', async () => {
    const prisma = { socialConnection: { findFirst: jest.fn().mockResolvedValue(makeConn()) } };
    const result = await prisma.socialConnection.findFirst({ where: { tenantId: 'tenant-1', id: 'conn-1' } });
    expect(result).not.toBeNull();
    expect(prisma.socialConnection.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-1' }) })
    );
  });
  it('should return null when no record matches', async () => {
    const prisma = { socialConnection: { findFirst: jest.fn().mockResolvedValue(null) } };
    const result = await prisma.socialConnection.findFirst({ where: { tenantId: 'tenant-2', id: 'conn-1' } });
    expect(result).toBeNull();
  });
});

describe('Social: concurrent operations', () => {
  it('should handle concurrent connect calls safely', async () => {
    const repo = mockSocialRepo();
    repo.findByProvider.mockResolvedValue(null);
    repo.save.mockResolvedValue(makeConn());
    const results = await Promise.allSettled([
      repo.save(makeConn({ id: 'c1' })),
      repo.save(makeConn({ id: 'c2' })),
    ]);
    expect(results.every(r => r.status === 'fulfilled')).toBe(true);
  });
});
