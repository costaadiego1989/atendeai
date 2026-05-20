import { InitiateTrialSubscriptionUseCase } from '../application/use-cases/InitiateTrialSubscriptionUseCase';
import { IPaymentGateway } from '../domain/ports/IPaymentGateway';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';

describe('InitiateTrialSubscriptionUseCase', () => {
  let useCase: InitiateTrialSubscriptionUseCase;
  let paymentGateway: jest.Mocked<IPaymentGateway>;
  let eventBus: any;
  let billingQueue: jest.Mocked<Queue>;
  let configService: jest.Mocked<ConfigService>;
  let billingRepository: any;

  beforeEach(() => {
    paymentGateway = {
      createCustomer: jest.fn(),
      createSubscription: jest.fn(),
      getCustomer: jest.fn(),
      getSubscription: jest.fn(),
      cancelSubscription: jest.fn(),
    } as unknown as jest.Mocked<IPaymentGateway>;

    eventBus = {
      publish: jest.fn(),
    };

    billingQueue = {
      add: jest.fn(),
    } as unknown as jest.Mocked<Queue>;

    configService = {
      get: jest
        .fn()
        .mockImplementation((key: string, defaultValue?: number) => {
          if (key === 'TRIAL_WARNING_HOURS') return 165;
          if (key === 'TRIAL_EXPIRATION_HOURS') return 168;
          return defaultValue;
        }),
    } as unknown as jest.Mocked<ConfigService>;

    billingRepository = {
      saveSubscription: jest.fn().mockResolvedValue(undefined),
      saveUsage: jest.fn().mockResolvedValue(undefined),
      findSubscription: jest.fn().mockResolvedValue(null),
      getUsage: jest.fn().mockResolvedValue(null),
    };

    useCase = new InitiateTrialSubscriptionUseCase(
      paymentGateway,
      eventBus,
      billingQueue,
      configService,
      billingRepository,
    );
  });

  it('should create an Asaas customer (without subscription) and enqueue trial jobs', async () => {
    // Arrange
    paymentGateway.createCustomer.mockResolvedValue({ id: 'cus_123' } as any);

    const input = {
      tenantId: 'uuid-tenant-123',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '5511999999999',
      companyName: 'Acme Corp',
      plan: 'PROFISSIONAL',
      cpfCnpj: '12345678901234',
    };

    // Act
    const result = await useCase.execute(input);

    // Assert — customer is created in Asaas
    expect(paymentGateway.createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        email: input.email,
      }),
    );

    // Assert — NO subscription is created in Asaas during trial
    expect(paymentGateway.createSubscription).not.toHaveBeenCalled();

    // Assert — local subscription is saved
    expect(billingRepository.saveSubscription).toHaveBeenCalled();

    // Assert — trial jobs are enqueued with local subscription ID
    expect(billingQueue.add).toHaveBeenCalledWith(
      'check-trial-expiration',
      expect.objectContaining({ tenantId: 'uuid-tenant-123' }),
      { delay: 165 * 60 * 60 * 1000 },
    );

    expect(billingQueue.add).toHaveBeenCalledWith(
      'trial-expired',
      expect.objectContaining({ tenantId: 'uuid-tenant-123' }),
      { delay: 168 * 60 * 60 * 1000 },
    );

    // Assert — event is published with empty asaasSubscriptionId
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          tenantId: 'uuid-tenant-123',
          asaasCustomerId: 'cus_123',
          asaasSubscriptionId: '',
        }),
      }),
    );

    // Assert — returns local subscription ID (not Asaas ID)
    expect(result.subscriptionId).toBeDefined();
    expect(result.invoiceUrl).toBeUndefined();
  });
});
