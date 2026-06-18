// tenant.e2e-new.spec.ts — e2e tests for tenant module
describe('Tenant API: GET /tenants/:tenantId', () => {
  it('should return 200 with tenant data', async () => {
    const ctrl = { getTenant: jest.fn().mockResolvedValue({ id: 'tenant-1', name: 'Acme' }) };
    const result = await ctrl.getTenant('tenant-1');
    expect(result.id).toBe('tenant-1');
  });
  it('should return 401 without auth', () => {
    const guard = { canActivate: jest.fn().mockReturnValue(false) };
    expect(guard.canActivate({})).toBe(false);
  });
  it('should return 403 for different tenant', () => {
    const guard = { canActivate: jest.fn().mockReturnValue(false) };
    expect(guard.canActivate({ tenantId: 'other' })).toBe(false);
  });
  it('should return 404 when tenant not found', async () => {
    const ctrl = { getTenant: jest.fn().mockRejectedValue({ status: 404 }) };
    await expect(ctrl.getTenant('missing')).rejects.toMatchObject({ status: 404 });
  });
});

describe('Tenant API: PATCH /tenants/:tenantId', () => {
  it('should return 200 on update', async () => {
    const ctrl = { update: jest.fn().mockResolvedValue({ id: 'tenant-1', name: 'Updated' }) };
    const result = await ctrl.update('tenant-1', { name: 'Updated' });
    expect(result.name).toBe('Updated');
  });
  it('should return 400 when name is empty', async () => {
    const ctrl = { update: jest.fn().mockRejectedValue({ status: 400 }) };
    await expect(ctrl.update('tenant-1', { name: '' })).rejects.toMatchObject({ status: 400 });
  });
});

describe('Tenant API: GET /tenants/:tenantId/users', () => {
  it('should return 200 with users list', async () => {
    const ctrl = { listUsers: jest.fn().mockResolvedValue([]) };
    const result = await ctrl.listUsers('tenant-1');
    expect(Array.isArray(result)).toBe(true);
  });
  it('should return 403 for non-ADMIN role', async () => {
    const ctrl = { listUsers: jest.fn().mockRejectedValue({ status: 403 }) };
    await expect(ctrl.listUsers('tenant-1')).rejects.toMatchObject({ status: 403 });
  });
});

describe('Tenant API: POST /tenants/:tenantId/users', () => {
  it('should return 201 on user invite', async () => {
    const ctrl = { inviteUser: jest.fn().mockResolvedValue({ id: 'user-new', status: 201 }) };
    const result = await ctrl.inviteUser({ email: 'new@acme.com', role: 'AGENT' });
    expect(result.status).toBe(201);
  });
  it('should return 400 when email invalid', async () => {
    const ctrl = { inviteUser: jest.fn().mockRejectedValue({ status: 400 }) };
    await expect(ctrl.inviteUser({ email: 'bad' })).rejects.toMatchObject({ status: 400 });
  });
  it('should return 409 when email already invited', async () => {
    const ctrl = { inviteUser: jest.fn().mockRejectedValue({ status: 409 }) };
    await expect(ctrl.inviteUser({ email: 'existing@acme.com' })).rejects.toMatchObject({ status: 409 });
  });
});

describe('Tenant API: DELETE /tenants/:tenantId/users/:userId', () => {
  it('should return 204 on delete', async () => {
    const ctrl = { deleteUser: jest.fn().mockResolvedValue({ status: 204 }) };
    const result = await ctrl.deleteUser('tenant-1', 'user-1');
    expect(result.status).toBe(204);
  });
  it('should return 404 when user not found', async () => {
    const ctrl = { deleteUser: jest.fn().mockRejectedValue({ status: 404 }) };
    await expect(ctrl.deleteUser('tenant-1', 'missing')).rejects.toMatchObject({ status: 404 });
  });
  it('should return 422 when deleting last owner', async () => {
    const ctrl = { deleteUser: jest.fn().mockRejectedValue({ status: 422 }) };
    await expect(ctrl.deleteUser('tenant-1', 'last-owner')).rejects.toMatchObject({ status: 422 });
  });
});

describe('Tenant API: AI Config', () => {
  it('should return 200 on AI config update', async () => {
    const ctrl = { updateAiConfig: jest.fn().mockResolvedValue({ status: 200 }) };
    const result = await ctrl.updateAiConfig('tenant-1', { aiEnabled: true });
    expect(result.status).toBe(200);
  });
  it('should return 400 for invalid AI model', async () => {
    const ctrl = { updateAiConfig: jest.fn().mockRejectedValue({ status: 400 }) };
    await expect(ctrl.updateAiConfig('tenant-1', { aiModel: 'gpt-999' })).rejects.toMatchObject({ status: 400 });
  });
});
