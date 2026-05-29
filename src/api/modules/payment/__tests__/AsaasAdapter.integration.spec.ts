import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import { AsaasAdapter } from '../infrastructure/acl/AsaasAdapter';
import { buildRecoveryPaymentReference } from '@shared/contracts/payment-references';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
  },
}));

jest.mock('axios-retry', () => {
  const fn = jest.fn();
  (fn as any).exponentialDelay = jest.fn();
  (fn as any).isNetworkOrIdempotentRequestError = jest.fn();
  return {
    __esModule: true,
    default: fn,
  };
});

describe('AsaasAdapter', () => {
  let adapter: AsaasAdapter;
  let configService: jest.Mocked<ConfigService>;
  let httpClient: {
    post: jest.Mock;
    delete: jest.Mock;
    get: jest.Mock;
  };

  beforeEach(() => {
    httpClient = {
      post: jest.fn(),
      delete: jest.fn(),
      get: jest.fn(),
    };

    (axios.create as jest.Mock).mockReturnValue(httpClient);
    configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === 'ASAAS_API_KEY') return 'asaas-key';
        if (key === 'ASAAS_SANDBOX') return 'true';
        return defaultValue;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    adapter = new AsaasAdapter(configService);
  });

  it('should configure the axios client with sandbox base URL and token header', () => {
    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'https://sandbox.asaas.com/api/v3',
        headers: expect.objectContaining({
          access_token: 'asaas-key',
          'Content-Type': 'application/json',
        }),
        timeout: 10000,
      }),
    );
    expect(axiosRetry).toHaveBeenCalledWith(
      httpClient,
      expect.objectContaining({
        retries: 3,
      }),
    );
  });

  it('should map PAYMENT_RECEIVED to PAYMENT_CONFIRMED when parsing webhooks', () => {
    const result = adapter.parseWebhook({
      event: 'PAYMENT_RECEIVED',
      dateCreated: '2026-03-15T10:00:00.000Z',
      payment: {
        id: 'pay-1',
        externalReference: 'tenant-1',
        value: 149.9,
        confirmedDate: '2026-03-16T12:30:00.000Z',
      },
    });

    expect(result).toEqual({
      provider: 'ASAAS',
      eventType: 'PAYMENT_CONFIRMED',
      paymentId: 'pay-1',
      tenantId: 'tenant-1',
      amount: 149.9,
      occurredAt: new Date('2026-03-16T12:30:00.000Z'),
      rawReference: 'tenant-1',
      rawPayload: expect.any(Object),
    });
  });

  it('should extract tenantId from recovery payment references when parsing webhooks', () => {
    const result = adapter.parseWebhook({
      event: 'PAYMENT_CONFIRMED',
      dateCreated: '2026-03-20T10:00:00.000Z',
      payment: {
        id: 'pay-recovery-1',
        externalReference: buildRecoveryPaymentReference('tenant-123', 'case-456'),
        value: 89.9,
        confirmedDate: '2026-03-20T10:05:00.000Z',
      },
    });

    expect(result).toEqual({
      provider: 'ASAAS',
      eventType: 'PAYMENT_CONFIRMED',
      paymentId: 'pay-recovery-1',
      tenantId: 'tenant-123',
      amount: 89.9,
      occurredAt: new Date('2026-03-20T10:05:00.000Z'),
      rawReference: buildRecoveryPaymentReference('tenant-123', 'case-456'),
      rawPayload: expect.any(Object),
    });
  });

  it('should extract tenantId from compact scheduling references when parsing webhooks', () => {
    const result = adapter.parseWebhook({
      event: 'PAYMENT_CONFIRMED',
      dateCreated: '2026-03-20T10:00:00.000Z',
      payment: {
        id: 'pay-scheduling-compact-1',
        externalReference:
          'sch|tenant-123|professional-456|2030-07-20__19:00__20:00',
        value: 230,
        confirmedDate: '2026-03-20T10:05:00.000Z',
      },
    });

    expect(result).toEqual({
      provider: 'ASAAS',
      eventType: 'PAYMENT_CONFIRMED',
      paymentId: 'pay-scheduling-compact-1',
      tenantId: 'tenant-123',
      amount: 230,
      occurredAt: new Date('2026-03-20T10:05:00.000Z'),
      rawReference: 'sch|tenant-123|professional-456|2030-07-20__19:00__20:00',
      rawPayload: expect.any(Object),
    });
  });

  it('should map chargeback-related webhook events to PAYMENT_REFUNDED', () => {
    const result = adapter.parseWebhook({
      event: 'PAYMENT_CHARGEBACK_REQUESTED',
      dateCreated: '2026-03-20T09:00:00.000Z',
      payment: {
        id: 'pay-2',
        externalReference: 'tenant-1',
        value: 99,
      },
    });

    expect(result?.eventType).toBe('PAYMENT_REFUNDED');
    expect(result?.occurredAt).toEqual(new Date('2026-03-20T09:00:00.000Z'));
  });

  it('should return UNKNOWN for unsupported webhook events', () => {
    const result = adapter.parseWebhook({
      event: 'SOMETHING_ELSE',
      payment: {
        id: 'pay-3',
        externalReference: 'tenant-1',
      },
    });

    expect(result?.eventType).toBe('UNKNOWN');
  });

  it('should return null for malformed webhook payloads', () => {
    expect(adapter.parseWebhook(null)).toBeNull();
    expect(adapter.parseWebhook({ event: 'PAYMENT_CONFIRMED' })).toBeNull();
  });

  it('should create customers through the Asaas API', async () => {
    httpClient.post.mockResolvedValue({
      data: {
        id: 'cus-1',
        name: 'Cliente',
        cpfCnpj: '12345678901',
        email: 'cliente@test.com',
      },
    });

    const result = await adapter.createCustomer({
      name: 'Cliente',
      cpfCnpj: '12345678901',
      email: 'cliente@test.com',
    });

    expect(httpClient.post).toHaveBeenCalledWith('/customers', {
      name: 'Cliente',
      cpfCnpj: '12345678901',
      email: 'cliente@test.com',
    });
    expect(result).toEqual({
      id: 'cus-1',
      name: 'Cliente',
      cpfCnpj: '12345678901',
      email: 'cliente@test.com',
    });
  });

  it('should create subscriptions through the Asaas API', async () => {
    httpClient.post.mockResolvedValue({
      data: {
        id: 'sub-1',
        status: 'ACTIVE',
        value: 199,
        billingType: 'PIX',
        nextDueDate: '2026-04-01',
      },
    });

    const result = await adapter.createSubscription({
      customer: 'cus-1',
      billingType: 'PIX',
      value: 199,
      nextDueDate: '2026-04-01',
      cycle: 'MONTHLY',
    });

    expect(httpClient.post).toHaveBeenCalledWith('/subscriptions', {
      customer: 'cus-1',
      billingType: 'PIX',
      value: 199,
      nextDueDate: '2026-04-01',
      cycle: 'MONTHLY',
    });
    expect(result.id).toBe('sub-1');
  });

  it('should cancel subscriptions through the Asaas API', async () => {
    httpClient.delete.mockResolvedValue({
      data: {
        id: 'sub-1',
        status: 'CANCELLED',
        value: 199,
        billingType: 'PIX',
        nextDueDate: '2026-04-01',
      },
    });

    const result = await adapter.cancelSubscription('sub-1');

    expect(httpClient.delete).toHaveBeenCalledWith('/subscriptions/sub-1');
    expect(result.status).toBe('CANCELLED');
  });

  it('should get subscriptions through the Asaas API', async () => {
    httpClient.get.mockResolvedValue({
      data: {
        id: 'sub-1',
        status: 'ACTIVE',
        value: 199,
        billingType: 'PIX',
        nextDueDate: '2026-04-01',
      },
    });

    const result = await adapter.getSubscription('sub-1');

    expect(httpClient.get).toHaveBeenCalledWith('/subscriptions/sub-1');
    expect(result.status).toBe('ACTIVE');
  });

  it('should create payment links through the Asaas API', async () => {
    httpClient.post.mockResolvedValue({
      data: {
        id: 'plink-1',
        url: 'https://pay.asaas.com/plink-1',
      },
    });

    const result = await adapter.createPaymentLink({
      name: 'Plano',
      value: 49.9,
      billingType: 'UNDEFINED',
      chargeType: 'DETACHED',
    });

    expect(httpClient.post).toHaveBeenCalledWith('/paymentLinks', {
      name: 'Plano',
      value: 49.9,
      billingType: 'UNDEFINED',
      chargeType: 'DETACHED',
    });
    expect(result.url).toBe('https://pay.asaas.com/plink-1');
  });

  it('should forward externalReference when creating payment links', async () => {
    httpClient.post.mockResolvedValue({
      data: {
        id: 'plink-2',
        url: 'https://pay.asaas.com/plink-2',
      },
    });

    await adapter.createPaymentLink({
      name: 'Regularização',
      value: 145.8,
      billingType: 'PIX',
      chargeType: 'DETACHED',
      externalReference: buildRecoveryPaymentReference('tenant-123', 'case-456'),
    });

    expect(httpClient.post).toHaveBeenCalledWith('/paymentLinks', {
      name: 'Regularização',
      value: 145.8,
      billingType: 'PIX',
      chargeType: 'DETACHED',
      externalReference: buildRecoveryPaymentReference('tenant-123', 'case-456'),
    });
  });

  it('should wrap API errors with a normalized message', async () => {
    httpClient.post.mockRejectedValue({
      message: 'Request failed',
      response: {
        status: 400,
        data: {
          errors: [{ description: 'CPF/CNPJ invalido' }],
        },
      },
    });

    await expect(
      adapter.createCustomer({
        name: 'Cliente',
        cpfCnpj: '000',
        email: 'cliente@test.com',
      }),
    ).rejects.toThrow('Asaas API Error: CPF/CNPJ invalido');
  });
});
