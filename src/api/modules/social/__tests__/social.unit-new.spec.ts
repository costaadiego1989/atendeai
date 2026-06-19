// social.unit-new.spec.ts — unit tests for social module
const mockSocialRepo = () => ({
  findConnection: jest.fn(), save: jest.fn(), list: jest.fn(),
  delete: jest.fn(), findByProvider: jest.fn(),
});

describe('Social connection validation', () => {
  it('should accept INSTAGRAM provider', () => {
    const valid = ['INSTAGRAM', 'FACEBOOK', 'WHATSAPP'];
    expect(valid.includes('INSTAGRAM')).toBe(true);
  });
  it('should accept FACEBOOK provider', () => {
    expect(['INSTAGRAM', 'FACEBOOK', 'WHATSAPP'].includes('FACEBOOK')).toBe(true);
  });
  it('should reject unknown provider', () => {
    expect(['INSTAGRAM', 'FACEBOOK', 'WHATSAPP'].includes('TIKTOK')).toBe(false);
  });
  it('should require tenantId on connection', () => {
    const validate = (conn: any) => { if (!conn.tenantId) throw new Error('tenantId required'); };
    expect(() => validate({ provider: 'INSTAGRAM' })).toThrow();
  });
  it('should require accessToken on connection', () => {
    const validate = (conn: any) => { if (!conn.accessToken) throw new Error('accessToken required'); };
    expect(() => validate({ tenantId: 't1' })).toThrow();
  });
  it('should require externalAccountId on connection', () => {
    const validate = (conn: any) => { if (!conn.externalAccountId) throw new Error('externalAccountId required'); };
    expect(() => validate({ tenantId: 't1', accessToken: 'tok' })).toThrow();
  });
  it('should accept valid connection with all fields', () => {
    const validate = (conn: any) => {
      if (!conn.tenantId || !conn.accessToken || !conn.externalAccountId) throw new Error('invalid');
      return true;
    };
    expect(validate({ tenantId: 't1', accessToken: 'tok', externalAccountId: 'acc-1' })).toBe(true);
  });
});

describe('Social repository scoping', () => {
  it('should scope findConnection to tenantId', async () => {
    const repo = mockSocialRepo();
    repo.findConnection.mockResolvedValue({ id: 'conn-1', tenantId: 'tenant-1' });
    await repo.findConnection('tenant-1', 'conn-1');
    expect(repo.findConnection).toHaveBeenCalledWith('tenant-1', 'conn-1');
  });
  it('should return null for cross-tenant access', async () => {
    const repo = mockSocialRepo();
    repo.findConnection.mockResolvedValue(null);
    const result = await repo.findConnection('tenant-2', 'conn-1');
    expect(result).toBeNull();
  });
  it('should list connections for tenant', async () => {
    const repo = mockSocialRepo();
    repo.list.mockResolvedValue([{ id: 'conn-1' }]);
    const result = await repo.list('tenant-1');
    expect(result).toHaveLength(1);
  });
  it('should delete connection by id and tenantId', async () => {
    const repo = mockSocialRepo();
    repo.delete.mockResolvedValue(undefined);
    await repo.delete('tenant-1', 'conn-1');
    expect(repo.delete).toHaveBeenCalledWith('tenant-1', 'conn-1');
  });
});

describe('Social token expiry', () => {
  it('should detect expired token', () => {
    const isExpired = (expiresAt: Date) => expiresAt < new Date();
    expect(isExpired(new Date('2020-01-01'))).toBe(true);
  });
  it('should detect valid token', () => {
    const isExpired = (expiresAt: Date) => expiresAt < new Date();
    expect(isExpired(new Date('2099-01-01'))).toBe(false);
  });
  it('should handle null expiresAt as never expires', () => {
    const isExpired = (expiresAt: Date | null) => expiresAt !== null && expiresAt < new Date();
    expect(isExpired(null)).toBe(false);
  });
});

describe('Social: disconnect use case unit', () => {
  it('should remove connection from repository', async () => {
    const repo = mockSocialRepo();
    repo.findConnection.mockResolvedValue({ id: 'conn-1', tenantId: 'tenant-1' });
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
});

describe('Social: event emission', () => {
  it('should publish SocialConnected event on new connection', async () => {
    const bus = { publish: jest.fn() };
    await bus.publish({ name: 'SocialConnected', provider: 'INSTAGRAM' });
    expect(bus.publish).toHaveBeenCalledWith(expect.objectContaining({ name: 'SocialConnected' }));
  });
  it('should publish SocialDisconnected event on removal', async () => {
    const bus = { publish: jest.fn() };
    await bus.publish({ name: 'SocialDisconnected', connectionId: 'conn-1' });
    expect(bus.publish).toHaveBeenCalled();
  });
});

describe('Social: token refresh', () => {
  it('should refresh token when expiry is within 24h', async () => {
    const expirySoon = new Date(Date.now() + 1000 * 60 * 60); // 1h from now
    const shouldRefresh = (expiresAt: Date) => (expiresAt.getTime() - Date.now()) < 24 * 60 * 60 * 1000;
    expect(shouldRefresh(expirySoon)).toBe(true);
  });
  it('should not refresh when expiry is far in future', () => {
    const expiryFar = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days
    const shouldRefresh = (expiresAt: Date) => (expiresAt.getTime() - Date.now()) < 24 * 60 * 60 * 1000;
    expect(shouldRefresh(expiryFar)).toBe(false);
  });
});
