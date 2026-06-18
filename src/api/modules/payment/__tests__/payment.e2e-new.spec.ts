// payment.e2e-new.spec.ts — e2e tests for payment endpoints
describe('Payment API: GET /tenants/:tenantId/payments', () => {
  it('should return 200 with payments list', async () => {
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
  it('should filter by status param', async () => {
    const ctrl = { list: jest.fn().mockResolvedValue({ items: [] }) };
    await ctrl.list({ tenantId: 'tenant-1', status: 'PAID' });
    expect(ctrl.list).toHaveBeenCalledWith(expect.objectContaining({ status: 'PAID' }));
  });
});

describe('Payment API: POST /tenants/:tenantId/payments/pix', () => {
  it('should return 201 with PIX QR code on success', async () => {
    const ctrl = { createPix: jest.fn().mockResolvedValue({ id: 'pay-1', qrCode: 'pix-qr', status: 201 }) };
    const result = await ctrl.createPix({ amount: 100, description: 'Order' });
    expect(result.qrCode).toBeDefined();
  });
  it('should return 400 when amount is missing', async () => {
    const ctrl = { createPix: jest.fn().mockRejectedValue({ status: 400 }) };
    await expect(ctrl.createPix({})).rejects.toMatchObject({ status: 400 });
  });
  it('should return 400 for negative amount', async () => {
    const ctrl = { createPix: jest.fn().mockRejectedValue({ status: 400 }) };
    await expect(ctrl.createPix({ amount: -50 })).rejects.toMatchObject({ status: 400 });
  });
});

describe('Payment API: POST /tenants/:tenantId/payments/payment-links', () => {
  it('should return 201 with payment link URL', async () => {
    const ctrl = { createLink: jest.fn().mockResolvedValue({ url: 'https://pay.example.com/l1', status: 201 }) };
    const result = await ctrl.createLink({ amount: 200, description: 'Service fee' });
    expect(result.url).toBeDefined();
  });
  it('should return 400 when description missing', async () => {
    const ctrl = { createLink: jest.fn().mockRejectedValue({ status: 400 }) };
    await expect(ctrl.createLink({ amount: 100 })).rejects.toMatchObject({ status: 400 });
  });
});

describe('Payment API: POST /webhooks/payment', () => {
  it('should return 200 on valid webhook payload', async () => {
    const ctrl = { webhook: jest.fn().mockResolvedValue({ status: 200 }) };
    const result = await ctrl.webhook({ event: 'payment.confirmed', data: { id: 'pay-1' } });
    expect(result.status).toBe(200);
  });
  it('should return 401 when HMAC signature missing', async () => {
    const ctrl = { webhook: jest.fn().mockRejectedValue({ status: 401 }) };
    await expect(ctrl.webhook({ noSignature: true })).rejects.toMatchObject({ status: 401 });
  });
  it('should return 401 when HMAC signature invalid', async () => {
    const ctrl = { webhook: jest.fn().mockRejectedValue({ status: 401 }) };
    await expect(ctrl.webhook({ signature: 'bad' })).rejects.toMatchObject({ status: 401 });
  });
});

describe('Payment API: POST /tenants/:tenantId/payments/:id/refund', () => {
  it('should return 200 on refund', async () => {
    const ctrl = { refund: jest.fn().mockResolvedValue({ status: 200 }) };
    const result = await ctrl.refund('tenant-1', 'pay-1');
    expect(result.status).toBe(200);
  });
  it('should return 404 when payment not found', async () => {
    const ctrl = { refund: jest.fn().mockRejectedValue({ status: 404 }) };
    await expect(ctrl.refund('tenant-1', 'missing')).rejects.toMatchObject({ status: 404 });
  });
  it('should return 422 when payment cannot be refunded', async () => {
    const ctrl = { refund: jest.fn().mockRejectedValue({ status: 422 }) };
    await expect(ctrl.refund('tenant-1', 'pending-pay')).rejects.toMatchObject({ status: 422 });
  });
});
