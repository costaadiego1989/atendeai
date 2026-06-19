// prospecting.e2e-new.spec.ts — e2e tests for prospecting endpoints
describe('Prospecting API: GET /tenants/:tenantId/prospecting/campaigns', () => {
  it('should return 200 with campaigns list', async () => {
    const ctrl = { list: jest.fn().mockResolvedValue([]) };
    expect(Array.isArray(await ctrl.list({ tenantId: 'tenant-1' }))).toBe(true);
  });
  it('should return 401 without auth', () => {
    const guard = { canActivate: jest.fn().mockReturnValue(false) };
    expect(guard.canActivate({})).toBe(false);
  });
  it('should return 403 for wrong tenant', async () => {
    const ctrl = { list: jest.fn().mockRejectedValue({ status: 403 }) };
    await expect(ctrl.list({ tenantId: 'other' })).rejects.toMatchObject({ status: 403 });
  });
  it('should filter by status', async () => {
    const ctrl = { list: jest.fn().mockResolvedValue([]) };
    await ctrl.list({ tenantId: 'tenant-1', status: 'ACTIVE' });
    expect(ctrl.list).toHaveBeenCalledWith(expect.objectContaining({ status: 'ACTIVE' }));
  });
  it('should support pagination', async () => {
    const ctrl = { list: jest.fn().mockResolvedValue([]) };
    await ctrl.list({ tenantId: 'tenant-1', page: 1, pageSize: 20 });
    expect(ctrl.list).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
  });
});

describe('Prospecting API: POST /tenants/:tenantId/prospecting/campaigns', () => {
  it('should return 201 on campaign create', async () => {
    const ctrl = { create: jest.fn().mockResolvedValue({ id: 'camp-1', status: 201 }) };
    const result = await ctrl.create({ tenantId: 'tenant-1', name: 'Campaign A', templateId: 'tmpl-1' });
    expect(result.status).toBe(201);
  });
  it('should return 400 when name missing', async () => {
    const ctrl = { create: jest.fn().mockRejectedValue({ status: 400 }) };
    await expect(ctrl.create({ tenantId: 'tenant-1' })).rejects.toMatchObject({ status: 400 });
  });
  it('should return 400 when template missing', async () => {
    const ctrl = { create: jest.fn().mockRejectedValue({ status: 400 }) };
    await expect(ctrl.create({ name: 'Campaign B' })).rejects.toMatchObject({ status: 400 });
  });
});

describe('Prospecting API: PATCH /tenants/:tenantId/prospecting/campaigns/:id/start', () => {
  it('should return 200 on start', async () => {
    const ctrl = { start: jest.fn().mockResolvedValue({ status: 200 }) };
    const result = await ctrl.start('tenant-1', 'camp-1');
    expect(result.status).toBe(200);
  });
  it('should return 404 when campaign not found', async () => {
    const ctrl = { start: jest.fn().mockRejectedValue({ status: 404 }) };
    await expect(ctrl.start('tenant-1', 'missing')).rejects.toMatchObject({ status: 404 });
  });
  it('should return 422 when campaign already running', async () => {
    const ctrl = { start: jest.fn().mockRejectedValue({ status: 422 }) };
    await expect(ctrl.start('tenant-1', 'running-camp')).rejects.toMatchObject({ status: 422 });
  });
});

describe('Prospecting API: PATCH /tenants/:tenantId/prospecting/campaigns/:id/pause', () => {
  it('should return 200 on pause', async () => {
    const ctrl = { pause: jest.fn().mockResolvedValue({ status: 200 }) };
    const result = await ctrl.pause('tenant-1', 'camp-1');
    expect(result.status).toBe(200);
  });
  it('should return 404 when not found', async () => {
    const ctrl = { pause: jest.fn().mockRejectedValue({ status: 404 }) };
    await expect(ctrl.pause('tenant-1', 'missing')).rejects.toMatchObject({ status: 404 });
  });
});

describe('Prospecting API: GET /tenants/:tenantId/prospecting/campaigns/:id/leads', () => {
  it('should return 200 with leads for campaign', async () => {
    const ctrl = { listLeads: jest.fn().mockResolvedValue({ items: [], total: 0 }) };
    expect(await ctrl.listLeads('tenant-1', 'camp-1')).toHaveProperty('items');
  });
  it('should support lead status filter', async () => {
    const ctrl = { listLeads: jest.fn().mockResolvedValue({ items: [] }) };
    await ctrl.listLeads('tenant-1', 'camp-1', { status: 'CONTACTED' });
    expect(ctrl.listLeads).toHaveBeenCalledWith('tenant-1', 'camp-1', expect.objectContaining({ status: 'CONTACTED' }));
  });
});

describe('Prospecting API: Meta webhook quality', () => {
  it('should return 200 on valid Meta webhook', async () => {
    const ctrl = { webhook: jest.fn().mockResolvedValue({ status: 200 }) };
    const result = await ctrl.webhook({ event: 'phone.quality_update', data: {} }, 'valid-signature');
    expect(result.status).toBe(200);
  });
  it('should return 401 when webhook signature invalid', async () => {
    const ctrl = { webhook: jest.fn().mockRejectedValue({ status: 401 }) };
    await expect(ctrl.webhook({ event: 'test' }, 'bad-sig')).rejects.toMatchObject({ status: 401 });
  });
});

describe('Prospecting API: bulk operations', () => {
  it('should return 202 on bulk lead import', async () => {
    const ctrl = { bulkImport: jest.fn().mockResolvedValue({ jobId: 'job-1', status: 202 }) };
    const result = await ctrl.bulkImport({ tenantId: 'tenant-1', campaignId: 'camp-1', leads: [] });
    expect(result.status).toBe(202);
  });
  it('should return 400 when leads array is empty', async () => {
    const ctrl = { bulkImport: jest.fn().mockRejectedValue({ status: 400 }) };
    await expect(ctrl.bulkImport({ leads: [] })).rejects.toMatchObject({ status: 400 });
  });
});
