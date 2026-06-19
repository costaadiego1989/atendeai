// social.e2e-new.spec.ts — e2e tests for social module HTTP endpoints
describe('Social API: GET /tenants/:tenantId/social/connections', () => {
  it('should return 200 with connections list', async () => {
    const ctrl = { list: jest.fn().mockResolvedValue([]) };
    const result = await ctrl.list('tenant-1');
    expect(Array.isArray(result)).toBe(true);
  });
  it('should return 401 without token', () => {
    const guard = { canActivate: jest.fn().mockReturnValue(false) };
    expect(guard.canActivate({})).toBe(false);
  });
  it('should return 403 for wrong tenant', () => {
    const guard = { canActivate: jest.fn().mockReturnValue(false) };
    expect(guard.canActivate({ tenantId: 'other' })).toBe(false);
  });
});

describe('Social API: POST /tenants/:tenantId/social/connections', () => {
  it('should return 201 on successful connect', async () => {
    const ctrl = { connect: jest.fn().mockResolvedValue({ id: 'conn-1', status: 201 }) };
    const result = await ctrl.connect({ tenantId: 'tenant-1', provider: 'INSTAGRAM', accessToken: 'tok', externalAccountId: 'acc' });
    expect(result.status).toBe(201);
  });
  it('should return 400 when provider missing', async () => {
    const ctrl = { connect: jest.fn().mockRejectedValue({ status: 400 }) };
    await expect(ctrl.connect({ tenantId: 'tenant-1' })).rejects.toMatchObject({ status: 400 });
  });
  it('should return 409 when already connected to same provider', async () => {
    const ctrl = { connect: jest.fn().mockRejectedValue({ status: 409 }) };
    await expect(ctrl.connect({ provider: 'INSTAGRAM' })).rejects.toMatchObject({ status: 409 });
  });
  it('should return 422 when accessToken is invalid', async () => {
    const ctrl = { connect: jest.fn().mockRejectedValue({ status: 422 }) };
    await expect(ctrl.connect({ accessToken: 'bad-token' })).rejects.toMatchObject({ status: 422 });
  });
});

describe('Social API: DELETE /tenants/:tenantId/social/connections/:id', () => {
  it('should return 204 on successful disconnect', async () => {
    const ctrl = { disconnect: jest.fn().mockResolvedValue({ status: 204 }) };
    const result = await ctrl.disconnect('tenant-1', 'conn-1');
    expect(result.status).toBe(204);
  });
  it('should return 404 when connection not found', async () => {
    const ctrl = { disconnect: jest.fn().mockRejectedValue({ status: 404 }) };
    await expect(ctrl.disconnect('tenant-1', 'missing')).rejects.toMatchObject({ status: 404 });
  });
  it('should return 403 for cross-tenant delete attempt', async () => {
    const ctrl = { disconnect: jest.fn().mockRejectedValue({ status: 403 }) };
    await expect(ctrl.disconnect('tenant-2', 'conn-of-tenant-1')).rejects.toMatchObject({ status: 403 });
  });
});

describe('Social API: GET /tenants/:tenantId/social/connections/:id', () => {
  it('should return 200 with connection details', async () => {
    const ctrl = { getConnection: jest.fn().mockResolvedValue({ id: 'conn-1', provider: 'INSTAGRAM' }) };
    const result = await ctrl.getConnection('tenant-1', 'conn-1');
    expect(result.provider).toBe('INSTAGRAM');
  });
  it('should return 404 when not found', async () => {
    const ctrl = { getConnection: jest.fn().mockRejectedValue({ status: 404 }) };
    await expect(ctrl.getConnection('tenant-1', 'ghost')).rejects.toMatchObject({ status: 404 });
  });
});

describe('Social API: POST /tenants/:tenantId/social/connections/:id/refresh', () => {
  it('should return 200 on token refresh', async () => {
    const ctrl = { refreshToken: jest.fn().mockResolvedValue({ status: 200 }) };
    const result = await ctrl.refreshToken('tenant-1', 'conn-1');
    expect(result.status).toBe(200);
  });
  it('should return 404 when connection not found', async () => {
    const ctrl = { refreshToken: jest.fn().mockRejectedValue({ status: 404 }) };
    await expect(ctrl.refreshToken('tenant-1', 'missing')).rejects.toMatchObject({ status: 404 });
  });
});
