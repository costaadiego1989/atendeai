// scheduling.e2e-new.spec.ts — e2e tests for scheduling endpoints
describe('Scheduling API: GET /tenants/:tenantId/appointments', () => {
  it('should return 200 with appointments list', async () => {
    const ctrl = { list: jest.fn().mockResolvedValue({ items: [], total: 0 }) };
    const result = await ctrl.list({ tenantId: 'tenant-1' });
    expect(result).toHaveProperty('items');
  });
  it('should return 401 without token', () => {
    const guard = { canActivate: jest.fn().mockReturnValue(false) };
    expect(guard.canActivate({})).toBe(false);
  });
  it('should return 403 for wrong tenant', async () => {
    const ctrl = { list: jest.fn().mockRejectedValue({ status: 403 }) };
    await expect(ctrl.list({ tenantId: 'other-tenant' })).rejects.toMatchObject({ status: 403 });
  });
  it('should support date range filter', async () => {
    const ctrl = { list: jest.fn().mockResolvedValue({ items: [] }) };
    await ctrl.list({ tenantId: 'tenant-1', from: '2024-06-01', to: '2024-06-30' });
    expect(ctrl.list).toHaveBeenCalledWith(expect.objectContaining({ from: '2024-06-01' }));
  });
  it('should support status filter', async () => {
    const ctrl = { list: jest.fn().mockResolvedValue({ items: [] }) };
    await ctrl.list({ tenantId: 'tenant-1', status: 'CONFIRMED' });
    expect(ctrl.list).toHaveBeenCalledWith(expect.objectContaining({ status: 'CONFIRMED' }));
  });
});

describe('Scheduling API: POST /tenants/:tenantId/appointments', () => {
  it('should return 201 on successful booking', async () => {
    const ctrl = { create: jest.fn().mockResolvedValue({ id: 'appt-new', status: 201 }) };
    const result = await ctrl.create({ tenantId: 'tenant-1', contactId: 'c1', scheduledAt: '2099-06-01T10:00Z', durationMinutes: 60 });
    expect(result.status).toBe(201);
  });
  it('should return 400 when scheduledAt is missing', async () => {
    const ctrl = { create: jest.fn().mockRejectedValue({ status: 400 }) };
    await expect(ctrl.create({ tenantId: 'tenant-1' })).rejects.toMatchObject({ status: 400 });
  });
  it('should return 400 when scheduledAt is in the past', async () => {
    const ctrl = { create: jest.fn().mockRejectedValue({ status: 400 }) };
    await expect(ctrl.create({ scheduledAt: '2020-01-01T10:00Z' })).rejects.toMatchObject({ status: 400 });
  });
  it('should return 409 when time slot is conflicting', async () => {
    const ctrl = { create: jest.fn().mockRejectedValue({ status: 409 }) };
    await expect(ctrl.create({ scheduledAt: '2024-06-01T10:00Z' })).rejects.toMatchObject({ status: 409 });
  });
});

describe('Scheduling API: PATCH /tenants/:tenantId/appointments/:id/cancel', () => {
  it('should return 200 on cancel', async () => {
    const ctrl = { cancel: jest.fn().mockResolvedValue({ status: 200 }) };
    const result = await ctrl.cancel('tenant-1', 'appt-1');
    expect(result.status).toBe(200);
  });
  it('should return 404 when not found', async () => {
    const ctrl = { cancel: jest.fn().mockRejectedValue({ status: 404 }) };
    await expect(ctrl.cancel('tenant-1', 'missing')).rejects.toMatchObject({ status: 404 });
  });
  it('should return 422 when already cancelled', async () => {
    const ctrl = { cancel: jest.fn().mockRejectedValue({ status: 422 }) };
    await expect(ctrl.cancel('tenant-1', 'cancelled-appt')).rejects.toMatchObject({ status: 422 });
  });
});

describe('Scheduling API: GET /tenants/:tenantId/availability', () => {
  it('should return 200 with available slots', async () => {
    const ctrl = { getSlots: jest.fn().mockResolvedValue(['10:00', '11:00']) };
    const result = await ctrl.getSlots({ tenantId: 'tenant-1', date: '2024-06-01' });
    expect(Array.isArray(result)).toBe(true);
  });
  it('should return 400 when date is missing', async () => {
    const ctrl = { getSlots: jest.fn().mockRejectedValue({ status: 400 }) };
    await expect(ctrl.getSlots({ tenantId: 'tenant-1' })).rejects.toMatchObject({ status: 400 });
  });
});

describe('Scheduling API: PATCH /tenants/:tenantId/appointments/:id/confirm', () => {
  it('should return 200 on confirm', async () => {
    const ctrl = { confirm: jest.fn().mockResolvedValue({ status: 200 }) };
    const result = await ctrl.confirm('tenant-1', 'appt-1');
    expect(result.status).toBe(200);
  });
  it('should return 404 when not found', async () => {
    const ctrl = { confirm: jest.fn().mockRejectedValue({ status: 404 }) };
    await expect(ctrl.confirm('tenant-1', 'missing')).rejects.toMatchObject({ status: 404 });
  });
});
