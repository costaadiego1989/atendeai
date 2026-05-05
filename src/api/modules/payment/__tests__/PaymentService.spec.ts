import { PaymentService } from '../application/services/PaymentService';
import { IPaymentGateway } from '../domain/ports/IPaymentGateway';

describe('PaymentService', () => {
  let service: PaymentService;
  let paymentGateway: jest.Mocked<IPaymentGateway>;

  beforeEach(() => {
    paymentGateway = {
      createCustomer: jest.fn(),
      createSubaccount: jest.fn(),
      listSubaccounts: jest.fn(),
      createSubscription: jest.fn(),
      updateSubscription: jest.fn(),
      cancelSubscription: jest.fn(),
      getSubscription: jest.fn(),
      createPayment: jest.fn(),
      deletePayment: jest.fn(),
      restorePayment: jest.fn(),
      createPaymentLink: jest.fn(),
      removePaymentLink: jest.fn(),
      restorePaymentLink: jest.fn(),
      parseWebhook: jest.fn(),
      getCustomer: jest.fn(),
    };

    service = new PaymentService(paymentGateway);
  });

  it('should delegate createCustomer to the gateway', async () => {
    paymentGateway.createCustomer.mockResolvedValue({
      id: 'cus-1',
      name: 'Cliente',
      cpfCnpj: '12345678901',
      email: 'cliente@test.com',
    });

    const result = await service.createCustomer({
      name: 'Cliente',
      cpfCnpj: '12345678901',
      email: 'cliente@test.com',
    });

    expect(paymentGateway.createCustomer).toHaveBeenCalledWith({
      name: 'Cliente',
      cpfCnpj: '12345678901',
      email: 'cliente@test.com',
    });
    expect(result.id).toBe('cus-1');
  });

  it('should delegate createSubscription to the gateway', async () => {
    paymentGateway.createSubscription.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      value: 99,
      billingType: 'PIX',
      nextDueDate: '2026-04-01',
    });

    const input = {
      customer: 'cus-1',
      billingType: 'PIX' as const,
      value: 99,
      nextDueDate: '2026-04-01',
      cycle: 'MONTHLY' as const,
    };

    const result = await service.createSubscription(input);

    expect(paymentGateway.createSubscription).toHaveBeenCalledWith(input);
    expect(result.id).toBe('sub-1');
  });

  it('should delegate cancelSubscription to the gateway', async () => {
    paymentGateway.cancelSubscription.mockResolvedValue({
      id: 'sub-1',
      status: 'CANCELLED',
      value: 99,
      billingType: 'PIX',
      nextDueDate: '2026-04-01',
    });

    const result = await service.cancelSubscription('sub-1');

    expect(paymentGateway.cancelSubscription).toHaveBeenCalledWith('sub-1');
    expect(result.status).toBe('CANCELLED');
  });

  it('should delegate createPaymentLink to the gateway', async () => {
    paymentGateway.createPaymentLink.mockResolvedValue({
      id: 'link-1',
      url: 'https://pay.example/link-1',
    });

    const input = {
      name: 'Plano',
      description: 'Pagamento avulso',
      value: 149,
      billingType: 'PIX' as const,
      chargeType: 'DETACHED' as const,
    };

    const result = await service.createPaymentLink(input);

    expect(paymentGateway.createPaymentLink).toHaveBeenCalledWith(input);
    expect(result.url).toBe('https://pay.example/link-1');
  });
});
