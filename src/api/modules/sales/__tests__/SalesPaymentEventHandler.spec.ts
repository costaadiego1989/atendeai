import { SalesPaymentEventHandler } from '../application/handlers/SalesPaymentEventHandler';
import { IEventBus } from '@shared/application/ports/IEventBus';
import { ISalesPaymentLinksRepository } from '../domain/repositories/ISalesRepository';
import {
  SalesPaymentConfirmedConversationIntegrationEvent,
  SalesPaymentLinkOverdueRemarketingIntegrationEvent,
} from '../application/integration-events/SalesIntegrationEvents';

describe('SalesPaymentEventHandler', () => {
  let handler: SalesPaymentEventHandler;
  let eventBus: jest.Mocked<IEventBus>;
  let repository: jest.Mocked<ISalesPaymentLinksRepository>;

  const tenantId = 'tenant-123';
  const contactId = 'contact-456';
  const rawReference = `sales-link|${tenantId}|link-789`;

  const updatedLink = {
    id: 'link-789',
    tenantId,
    branchId: 'branch-1',
    providerLinkId: 'prov-1',
    externalId: rawReference,
    name: 'Test Link',
    description: null,
    label: null,
    value: 100,
    url: 'https://pay.example.com/link-789',
    billingType: 'PIX' as const,
    status: 'PAID' as const,
    source: 'MANUAL' as const,
    resourceType: 'PAYMENT_LINK' as const,
    contactId,
    contactName: null,
    conversationId: 'conv-1',
    catalogItemId: null,
    catalogItemSku: null,
    catalogItemName: null,
    expiresAt: null,
    recurrenceEnabled: false,
    recurrenceFrequency: null,
    recurrenceStartDate: null,
    recurrenceEndDate: null,
    recurrenceTotalValue: null,
    recurrenceNextRunAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(() => {
    eventBus = {
      publish: jest.fn(),
      subscribe: jest.fn(),
    };

    repository = {
      createPaymentLink: jest.fn(),
      listPaymentLinks: jest.fn(),
      findPaymentLinkById: jest.fn(),
      updatePaymentLinkStatus: jest.fn(),
      updatePaymentLinkStatusByExternalReference: jest.fn(),
      findContactNameById: jest.fn(),
    };

    handler = new SalesPaymentEventHandler(eventBus, repository);
  });

  describe('onModuleInit', () => {
    it('should subscribe to payment.confirmed, payment.overdue, and payment.refunded', () => {
      handler.onModuleInit();

      expect(eventBus.subscribe).toHaveBeenCalledTimes(3);
      expect(eventBus.subscribe).toHaveBeenNthCalledWith(
        1,
        'payment.confirmed',
        expect.any(Function),
        { consumerName: 'sales-payment-confirmed' },
      );
      expect(eventBus.subscribe).toHaveBeenNthCalledWith(
        2,
        'payment.overdue',
        expect.any(Function),
        { consumerName: 'sales-payment-overdue' },
      );
      expect(eventBus.subscribe).toHaveBeenNthCalledWith(
        3,
        'payment.refunded',
        expect.any(Function),
        { consumerName: 'sales-payment-refunded' },
      );
    });
  });

  describe('handlePaymentEvent', () => {
    function getCallback(eventName: string): (event: any) => Promise<void> {
      handler.onModuleInit();
      return eventBus.subscribe.mock.calls.find(
        ([name]) => name === eventName,
      )?.[1] as (event: any) => Promise<void>;
    }

    it('should skip when tenantId is missing', async () => {
      const callback = getCallback('payment.confirmed');

      await callback({
        payload: { tenantId: undefined, rawReference },
      });

      expect(
        repository.updatePaymentLinkStatusByExternalReference,
      ).not.toHaveBeenCalled();
    });

    it('should skip when rawReference is missing', async () => {
      const callback = getCallback('payment.confirmed');

      await callback({
        payload: { tenantId, rawReference: undefined },
      });

      expect(
        repository.updatePaymentLinkStatusByExternalReference,
      ).not.toHaveBeenCalled();
    });

    it('should skip when rawReference does not match sales pattern', async () => {
      const callback = getCallback('payment.confirmed');

      await callback({
        payload: { tenantId, rawReference: 'scheduling|tenant-123|slot-1' },
      });

      expect(
        repository.updatePaymentLinkStatusByExternalReference,
      ).not.toHaveBeenCalled();
    });

    it('should skip when tenantId in reference does not match event tenantId', async () => {
      const callback = getCallback('payment.confirmed');

      await callback({
        payload: {
          tenantId: 'other-tenant',
          rawReference: `sales-link|${tenantId}|link-789`,
        },
      });

      expect(
        repository.updatePaymentLinkStatusByExternalReference,
      ).not.toHaveBeenCalled();
    });

    it('should update status and publish SalesPaymentConfirmedConversationIntegrationEvent on PAID', async () => {
      repository.updatePaymentLinkStatusByExternalReference.mockResolvedValue(
        updatedLink,
      );
      repository.findContactNameById.mockResolvedValue('João Silva');

      const callback = getCallback('payment.confirmed');
      await callback({ payload: { tenantId, rawReference } });

      expect(
        repository.updatePaymentLinkStatusByExternalReference,
      ).toHaveBeenCalledWith(tenantId, rawReference, 'PAID');
      expect(repository.findContactNameById).toHaveBeenCalledWith(
        tenantId,
        contactId,
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(SalesPaymentConfirmedConversationIntegrationEvent),
      );
      const publishedEvent = eventBus.publish.mock.calls[0][0] as any;
      expect(publishedEvent.payload).toEqual({
        tenantId,
        contactId,
        contactName: 'João Silva',
        branchId: 'branch-1',
        conversationId: 'conv-1',
        paymentLinkUrl: 'https://pay.example.com/link-789',
        linkTitle: 'Test Link',
        value: 100,
      });
    });

    it('should use "Cliente" as fallback when contact name is not found', async () => {
      repository.updatePaymentLinkStatusByExternalReference.mockResolvedValue(
        updatedLink,
      );
      repository.findContactNameById.mockResolvedValue(null);

      const callback = getCallback('payment.confirmed');
      await callback({ payload: { tenantId, rawReference } });

      const publishedEvent = eventBus.publish.mock.calls[0][0] as any;
      expect(publishedEvent.payload.contactName).toBe('Cliente');
    });

    it('should publish SalesPaymentLinkOverdueRemarketingIntegrationEvent on OVERDUE for sales-link', async () => {
      repository.updatePaymentLinkStatusByExternalReference.mockResolvedValue({
        ...updatedLink,
        status: 'OVERDUE',
      });
      repository.findContactNameById.mockResolvedValue('Maria');

      const callback = getCallback('payment.overdue');
      await callback({ payload: { tenantId, rawReference } });

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(SalesPaymentLinkOverdueRemarketingIntegrationEvent),
      );
    });

    it('should NOT publish remarketing event on OVERDUE for sales-charge', async () => {
      const chargeRef = `sales-charge|${tenantId}|charge-1`;
      repository.updatePaymentLinkStatusByExternalReference.mockResolvedValue({
        ...updatedLink,
        externalId: chargeRef,
        status: 'OVERDUE',
      });
      repository.findContactNameById.mockResolvedValue('Maria');

      const callback = getCallback('payment.overdue');
      await callback({ payload: { tenantId, rawReference: chargeRef } });

      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('should not publish any event on REFUNDED', async () => {
      repository.updatePaymentLinkStatusByExternalReference.mockResolvedValue({
        ...updatedLink,
        status: 'REFUNDED',
      });
      repository.findContactNameById.mockResolvedValue('Maria');

      const callback = getCallback('payment.refunded');
      await callback({
        payload: { tenantId, rawReference },
      });

      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('should not publish event when contactId is null', async () => {
      repository.updatePaymentLinkStatusByExternalReference.mockResolvedValue({
        ...updatedLink,
        contactId: null,
      });

      const callback = getCallback('payment.confirmed');
      await callback({ payload: { tenantId, rawReference } });

      expect(repository.findContactNameById).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('should warn when payment link is not found', async () => {
      repository.updatePaymentLinkStatusByExternalReference.mockResolvedValue(
        null,
      );

      const callback = getCallback('payment.confirmed');
      await callback({ payload: { tenantId, rawReference } });

      expect(eventBus.publish).not.toHaveBeenCalled();
    });
  });
});
