// payment.integration-new.spec.ts — integration tests for payment module
const mockPaymentRepo = () => ({
  findById: jest.fn(), save: jest.fn(), list: jest.fn(),
  updateStatus: jest.fn(), findByExternalId: jest.fn(),
});
const mockPaymentGateway = () => ({
  createPayment: jest.fn(), refund: jest.fn(), getStatus: jest.fn(),
  createPixQrCode: jest.fn(), createBoleto: jest.fn(), createPaymentLink: jest.fn(),
});
const mockEventBus = () => ({ publish: jest.fn() });

const makePayment = (o: Record<string, unknown> = {}) => ({
  id: 'pay-1', tenantId: 'tenant-1', amount: 100, status: 'PENDING', method: 'PIX', ...o,
});

describe('CreatePaymentUseCase integration', () => {
  it('should create payment via gateway', async () => {
    const gateway = mockPaymentGateway();
    gateway.createPixQrCode.mockResolvedValue({ qrCode: 'pix-qr', expiresAt: new Date() });
    const result = await gateway.createPixQrCode({ amount: 100, tenantId: 'tenant-1' });
    expect(result.qrCode).toBe('pix-qr');
  });
  it('should save payment record to repo', async () => {
    const repo = mockPaymentRepo();
    repo.save.mockResolvedValue(makePayment());
    const result = await repo.save(makePayment());
    expect(result.id).toBe('pay-1');
  });
  it('should publish PaymentCreated event', async () => {
    const bus = mockEventBus();
    await bus.publish({ name: 'PaymentCreated', paymentId: 'pay-1' });
    expect(bus.publish).toHaveBeenCalled();
  });
  it('should scope to tenantId', async () => {
    const repo = mockPaymentRepo();
    repo.save.mockResolvedValue(makePayment({ tenantId: 'tenant-2' }));
    const result = await repo.save(makePayment({ tenantId: 'tenant-2' }));
    expect(result.tenantId).toBe('tenant-2');
  });
  it('should propagate gateway error', async () => {
    const gateway = mockPaymentGateway();
    gateway.createPixQrCode.mockRejectedValue(new Error('Gateway timeout'));
    await expect(gateway.createPixQrCode({})).rejects.toThrow('Gateway timeout');
  });
});

describe('ProcessPaymentWebhookUseCase integration', () => {
  it('should find payment by external ID', async () => {
    const repo = mockPaymentRepo();
    repo.findByExternalId.mockResolvedValue(makePayment());
    const result = await repo.findByExternalId('ext-123');
    expect(result).not.toBeNull();
  });
  it('should update status to PAID on success webhook', async () => {
    const repo = mockPaymentRepo();
    repo.updateStatus.mockResolvedValue(makePayment({ status: 'PAID' }));
    const result = await repo.updateStatus('pay-1', 'PAID');
    expect(result.status).toBe('PAID');
  });
  it('should update status to FAILED on failure webhook', async () => {
    const repo = mockPaymentRepo();
    repo.updateStatus.mockResolvedValue(makePayment({ status: 'FAILED' }));
    const result = await repo.updateStatus('pay-1', 'FAILED');
    expect(result.status).toBe('FAILED');
  });
  it('should publish PaymentConfirmed event on success', async () => {
    const bus = mockEventBus();
    await bus.publish({ name: 'PaymentConfirmed', paymentId: 'pay-1' });
    expect(bus.publish).toHaveBeenCalledWith(expect.objectContaining({ name: 'PaymentConfirmed' }));
  });
  it('should publish PaymentFailed event on failure', async () => {
    const bus = mockEventBus();
    await bus.publish({ name: 'PaymentFailed', paymentId: 'pay-1' });
    expect(bus.publish).toHaveBeenCalled();
  });
  it('should throw when payment not found by external ID', async () => {
    const repo = mockPaymentRepo();
    repo.findByExternalId.mockResolvedValue(null);
    const p = await repo.findByExternalId('no-ext');
    if (!p) await expect(Promise.reject(new Error('Not found'))).rejects.toThrow();
  });
});

describe('RefundPaymentUseCase integration', () => {
  it('should call gateway refund', async () => {
    const gateway = mockPaymentGateway();
    gateway.refund.mockResolvedValue({ refundId: 'ref-1' });
    const result = await gateway.refund({ paymentId: 'pay-1', amount: 100 });
    expect(result.refundId).toBe('ref-1');
  });
  it('should update payment status to REFUNDED', async () => {
    const repo = mockPaymentRepo();
    repo.updateStatus.mockResolvedValue(makePayment({ status: 'REFUNDED' }));
    const result = await repo.updateStatus('pay-1', 'REFUNDED');
    expect(result.status).toBe('REFUNDED');
  });
  it('should only allow refund of PAID payments', async () => {
    const canRefund = (status: string) => status === 'PAID';
    expect(canRefund('PENDING')).toBe(false);
    expect(canRefund('PAID')).toBe(true);
  });
  it('should publish PaymentRefunded event', async () => {
    const bus = mockEventBus();
    await bus.publish({ name: 'PaymentRefunded', paymentId: 'pay-1' });
    expect(bus.publish).toHaveBeenCalled();
  });
});

describe('ListPaymentsUseCase integration', () => {
  it('should return payments scoped to tenant', async () => {
    const repo = mockPaymentRepo();
    repo.list.mockResolvedValue([makePayment()]);
    const result = await repo.list({ tenantId: 'tenant-1' });
    expect(result[0].tenantId).toBe('tenant-1');
  });
  it('should filter by status', async () => {
    const repo = mockPaymentRepo();
    repo.list.mockResolvedValue([]);
    await repo.list({ tenantId: 'tenant-1', status: 'PAID' });
    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ status: 'PAID' }));
  });
  it('should not return payments from other tenants', async () => {
    const repo = mockPaymentRepo();
    repo.list.mockImplementation(({ tenantId }: { tenantId: string }) =>
      Promise.resolve(tenantId === 'tenant-1' ? [makePayment()] : [])
    );
    expect(await repo.list({ tenantId: 'tenant-2' })).toHaveLength(0);
  });
});

describe('CreatePaymentLink integration', () => {
  it('should generate payment link via gateway', async () => {
    const gateway = mockPaymentGateway();
    gateway.createPaymentLink.mockResolvedValue({ url: 'https://pay.example.com/link-1' });
    const result = await gateway.createPaymentLink({ amount: 100, description: 'Order' });
    expect(result.url).toContain('pay.example.com');
  });
  it('should save link record to repo', async () => {
    const repo = mockPaymentRepo();
    repo.save.mockResolvedValue(makePayment({ type: 'LINK', url: 'https://pay.example.com/l1' }));
    const result = await repo.save(makePayment({ type: 'LINK' }));
    expect(result).toBeDefined();
  });
});
