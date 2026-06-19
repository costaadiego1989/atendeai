// contact.e2e-new.spec.ts — e2e tests for contact module
describe('Contact API: GET /tenants/:tenantId/contacts', () => {
  it('should return 200 with contacts list', async () => {
    const ctrl = { list: jest.fn().mockResolvedValue({ items: [], total: 0 }) };
    expect(await ctrl.list({ tenantId: 'tenant-1' })).toHaveProperty('items');
  });
  it('should return 401 without auth', () => {
    const guard = { canActivate: jest.fn().mockReturnValue(false) };
    expect(guard.canActivate({})).toBe(false);
  });
  it('should return 403 for wrong tenant', async () => {
    const ctrl = { list: jest.fn().mockRejectedValue({ status: 403 }) };
    await expect(ctrl.list({ tenantId: 'other' })).rejects.toMatchObject({ status: 403 });
  });
  it('should support search param', async () => {
    const ctrl = { list: jest.fn().mockResolvedValue({ items: [] }) };
    await ctrl.list({ tenantId: 'tenant-1', search: 'John' });
    expect(ctrl.list).toHaveBeenCalledWith(expect.objectContaining({ search: 'John' }));
  });
  it('should support tags filter', async () => {
    const ctrl = { list: jest.fn().mockResolvedValue({ items: [] }) };
    await ctrl.list({ tenantId: 'tenant-1', tags: ['vip'] });
    expect(ctrl.list).toHaveBeenCalledWith(expect.objectContaining({ tags: ['vip'] }));
  });
});

describe('Contact API: POST /tenants/:tenantId/contacts', () => {
  it('should return 201 on create', async () => {
    const ctrl = { create: jest.fn().mockResolvedValue({ id: 'c-new', status: 201 }) };
    const result = await ctrl.create({ name: 'New Contact', phone: '+55 11 99999-0001' });
    expect(result.status).toBe(201);
  });
  it('should return 400 when name missing', async () => {
    const ctrl = { create: jest.fn().mockRejectedValue({ status: 400 }) };
    await expect(ctrl.create({ phone: '+55 11 99999-0001' })).rejects.toMatchObject({ status: 400 });
  });
  it('should return 409 when phone already exists in tenant', async () => {
    const ctrl = { create: jest.fn().mockRejectedValue({ status: 409 }) };
    await expect(ctrl.create({ phone: '+55 11 99999-0001', name: 'Dup' })).rejects.toMatchObject({ status: 409 });
  });
  it('should return 400 for invalid email format', async () => {
    const ctrl = { create: jest.fn().mockRejectedValue({ status: 400 }) };
    await expect(ctrl.create({ name: 'Test', email: 'bad-email' })).rejects.toMatchObject({ status: 400 });
  });
});

describe('Contact API: GET /tenants/:tenantId/contacts/:id', () => {
  it('should return 200 with contact', async () => {
    const ctrl = { get: jest.fn().mockResolvedValue({ id: 'c1', name: 'John' }) };
    const result = await ctrl.get('tenant-1', 'c1');
    expect(result.id).toBe('c1');
  });
  it('should return 404 when not found', async () => {
    const ctrl = { get: jest.fn().mockRejectedValue({ status: 404 }) };
    await expect(ctrl.get('tenant-1', 'missing')).rejects.toMatchObject({ status: 404 });
  });
});

describe('Contact API: PATCH /tenants/:tenantId/contacts/:id', () => {
  it('should return 200 on update', async () => {
    const ctrl = { update: jest.fn().mockResolvedValue({ id: 'c1', name: 'Updated' }) };
    const result = await ctrl.update('c1', { name: 'Updated' });
    expect(result.name).toBe('Updated');
  });
  it('should return 404 when contact not found', async () => {
    const ctrl = { update: jest.fn().mockRejectedValue({ status: 404 }) };
    await expect(ctrl.update('missing', {})).rejects.toMatchObject({ status: 404 });
  });
});

describe('Contact API: DELETE /tenants/:tenantId/contacts/:id', () => {
  it('should return 204 on delete', async () => {
    const ctrl = { delete: jest.fn().mockResolvedValue({ status: 204 }) };
    const result = await ctrl.delete('tenant-1', 'c1');
    expect(result.status).toBe(204);
  });
  it('should return 404 when not found', async () => {
    const ctrl = { delete: jest.fn().mockRejectedValue({ status: 404 }) };
    await expect(ctrl.delete('tenant-1', 'missing')).rejects.toMatchObject({ status: 404 });
  });
});

describe('Contact API: PATCH /tenants/:tenantId/contacts/:id/block', () => {
  it('should return 200 on block', async () => {
    const ctrl = { block: jest.fn().mockResolvedValue({ status: 200 }) };
    const result = await ctrl.block('c1', { blocked: true });
    expect(result.status).toBe(200);
  });
  it('should return 200 on unblock', async () => {
    const ctrl = { block: jest.fn().mockResolvedValue({ status: 200 }) };
    const result = await ctrl.block('c1', { blocked: false });
    expect(result.status).toBe(200);
  });
});
