import { TrialExpirationProcessor } from '../application/workers/TrialExpirationProcessor';
import { IPaymentGateway } from '../domain/ports/IPaymentGateway';
import { IEventBus } from '@shared/application/ports/IEventBus';
import { Job } from 'bullmq';
import { TrialExpiringIntegrationEvent } from '../application/integration-events/TrialExpiringIntegrationEvent';

describe('TrialExpirationProcessor', () => {
    let processor: TrialExpirationProcessor;
    let paymentGateway: jest.Mocked<IPaymentGateway>;
    let eventBus: jest.Mocked<IEventBus>;

    beforeEach(() => {
        paymentGateway = {
            getSubscription: jest.fn(),
            createCustomer: jest.fn(),
            createSubscription: jest.fn(),
            getCustomer: jest.fn(),
            cancelSubscription: jest.fn(),
        } as unknown as jest.Mocked<IPaymentGateway>;

        eventBus = {
            publish: jest.fn(),
            subscribe: jest.fn(),
        } as unknown as jest.Mocked<IEventBus>;

        processor = new TrialExpirationProcessor(paymentGateway, eventBus);
    });

    it('should ignore if subscription is inactive', async () => {
        // Arrange
        paymentGateway.getSubscription.mockResolvedValue({ id: 'sub_123', status: 'INACTIVE' } as any);
        const job = { name: 'check-trial-expiration', data: { subscriptionId: 'sub_123', tenantId: 't1' } } as Job;

        // Act
        await processor.process(job);

        // Assert
        expect(paymentGateway.getSubscription).toHaveBeenCalledWith('sub_123');
        expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('should ignore if invoiceUrl is not available', async () => {
        // Arrange
        paymentGateway.getSubscription.mockResolvedValue({ id: 'sub_123', status: 'ACTIVE', invoiceUrl: null } as any);
        const job = { name: 'check-trial-expiration', data: { subscriptionId: 'sub_123', tenantId: 't1' } } as Job;

        // Act
        await processor.process(job);

        // Assert
        expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('should publish TrialExpiringIntegrationEvent if active and has invoiceUrl', async () => {
        // Arrange
        paymentGateway.getSubscription.mockResolvedValue({ id: 'sub_123', status: 'ACTIVE', invoiceUrl: 'http://invoice.url' } as any);
        const job = { name: 'check-trial-expiration', data: { subscriptionId: 'sub_123', tenantId: 't1' } } as Job;

        // Act
        await processor.process(job);

        // Assert
        expect(eventBus.publish).toHaveBeenCalledWith(expect.any(TrialExpiringIntegrationEvent));
        
        const calledEvent = eventBus.publish.mock.calls[0][0] as TrialExpiringIntegrationEvent;
        expect(calledEvent.eventData).toEqual({
            tenantId: 't1',
            subscriptionId: 'sub_123',
            invoiceUrl: 'http://invoice.url',
        });
    });
});
