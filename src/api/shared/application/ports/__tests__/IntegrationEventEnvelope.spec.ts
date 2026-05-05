import { TenantCreatedIntegrationEvent } from '@modules/tenant/application/integration-events/TenantIntegrationEvents';
import { ContactStageChangedIntegrationEvent } from '@modules/contact/application/integration-events/ContactIntegrationEvents';
import { MessageSentIntegrationEvent } from '@modules/messaging/application/integration-events/publishers/MessageSentIntegrationEvent';
import { PaymentConfirmedIntegrationEvent } from '@modules/payment/application/integration-events/PaymentIntegrationEvents';
import { AIResponseGeneratedIntegrationEvent } from '@modules/ai/application/integration-events/publishers/AIIntegrationEvents';
import { BillingCycleRenewedIntegrationEvent } from '@modules/billing/application/integration-events/BillingIntegrationEvents';
import { SalesPaymentLinkCreatedIntegrationEvent } from '@modules/sales/application/integration-events/SalesIntegrationEvents';

describe('IntegrationEvent envelope metadata', () => {
  it('should expose versioned event names without changing legacy queues', () => {
    const events = [
      new TenantCreatedIntegrationEvent({
        aggregateId: 'tenant-1',
        companyName: 'Tenant',
        cnpj: '123',
        plan: 'ESSENCIAL',
        ownerName: 'Owner',
        ownerEmail: 'owner@test.com',
        ownerPhone: '11999999999',
      }),
      new ContactStageChangedIntegrationEvent({
        contactId: 'contact-1',
        tenantId: 'tenant-1',
        previousStage: 'LEAD',
        newStage: 'CUSTOMER',
        changedAt: '2026-03-29T12:00:00.000Z',
      }),
      new MessageSentIntegrationEvent({
        tenantId: 'tenant-1',
        conversationId: 'conversation-1',
        contactId: 'contact-1',
        messageId: 'message-1',
        channel: 'WHATSAPP',
        content: { type: 'TEXT', text: 'Oi' },
      }),
      new PaymentConfirmedIntegrationEvent({
        tenantId: 'tenant-1',
        paymentId: 'payment-1',
        amount: 59.9,
        confirmedAt: new Date('2026-03-29T12:00:00.000Z'),
      }),
      new AIResponseGeneratedIntegrationEvent({
        conversationId: 'conversation-1',
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        aiSessionId: 'session-1',
        response: { type: 'TEXT', text: 'Resposta' },
        intent: 'PURCHASE',
        sentiment: 'POSITIVE',
        confidence: 0.9,
        tokensUsed: 42,
      }),
      new BillingCycleRenewedIntegrationEvent({
        tenantId: 'tenant-1',
        plan: 'PROFISSIONAL',
        billingCycleStart: '2026-03-29T12:00:00.000Z',
        billingCycleEnd: '2026-04-29T12:00:00.000Z',
        confirmedAt: '2026-03-29T12:00:00.000Z',
      }),
      new SalesPaymentLinkCreatedIntegrationEvent({
        tenantId: 'tenant-1',
        paymentLinkId: 'plink-1',
        url: 'https://pay.test/plink-1',
        name: 'Plano Premium',
        value: 99,
        billingType: 'PIX',
      }),
    ];

    expect(events.map((event) => event.queue)).toEqual([
      'tenant.created',
      'contact.stage-changed',
      'messaging.message-sent',
      'payment.confirmed',
      'ai.response-generated',
      'billing.cycle-renewed',
      'sales.payment-link-created',
    ]);

    expect(events.map((event) => event.toJSON().eventName)).toEqual([
      'tenant.tenant.created.v1',
      'contact.contact.stage-changed.v1',
      'messaging.message.sent.v1',
      'payment.payment.confirmed.v1',
      'ai.response.generated.v1',
      'billing.cycle.renewed.v1',
      'sales.payment-link.created.v1',
    ]);
  });
});
