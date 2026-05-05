import { InitiateTrialSubscriptionUseCase } from '../application/use-cases/InitiateTrialSubscriptionUseCase';
import { IPaymentGateway } from '../domain/ports/IPaymentGateway';
import { Queue } from 'bullmq';

describe('InitiateTrialSubscriptionUseCase', () => {
    let useCase: InitiateTrialSubscriptionUseCase;
    let paymentGateway: jest.Mocked<IPaymentGateway>;
    let billingQueue: jest.Mocked<Queue>;

    beforeEach(() => {
        paymentGateway = {
            createCustomer: jest.fn(),
            createSubscription: jest.fn(),
            getCustomer: jest.fn(),
            getSubscription: jest.fn(),
            cancelSubscription: jest.fn(),
        } as unknown as jest.Mocked<IPaymentGateway>;

        billingQueue = {
            add: jest.fn(),
        } as unknown as jest.Mocked<Queue>;

        useCase = new InitiateTrialSubscriptionUseCase(paymentGateway, billingQueue);
    });

    it('should create an Asaas customer and subscription, then enqueue a warning notification job', async () => {
        // Arrange
        paymentGateway.createCustomer.mockResolvedValue({ id: 'cus_123' } as any);
        paymentGateway.createSubscription.mockResolvedValue({ id: 'sub_123', invoiceUrl: 'http://test' } as any);

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

        // Assert
        expect(paymentGateway.createCustomer).toHaveBeenCalledWith(expect.objectContaining({
            email: input.email,
        }));
        
        expect(paymentGateway.createSubscription).toHaveBeenCalledWith(expect.objectContaining({
            customer: 'cus_123',
            externalReference: 'trial|uuid-tenant-123',
            trialDays: 7,
        }));

        expect(billingQueue.add).toHaveBeenCalledWith(
            'check-trial-expiration',
            { subscriptionId: 'sub_123', tenantId: 'uuid-tenant-123' },
            { delay: 165 * 60 * 60 * 1000 }
        );

        expect(result.subscriptionId).toBe('sub_123');
    });
});
