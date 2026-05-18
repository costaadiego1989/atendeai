import { CommerceOrdersReportCsvBuilder } from '../application/services/CommerceOrdersReportCsvBuilder';
import { CommerceOrderListItemRecord } from '../domain/ports/ICommerceRepository';

describe('CommerceOrdersReportCsvBuilder', () => {
  it('should build a csv report with checkout order financial data', () => {
    const builder = new CommerceOrdersReportCsvBuilder();
    const order: CommerceOrderListItemRecord = {
      id: 'order-1',
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      sessionId: 'session-1',
      conversationId: 'conversation-1',
      contactId: 'contact-1',
      status: 'PAID',
      fulfillmentType: 'DELIVERY',
      shippingMode: 'FIXED',
      subtotalAmount: 42.5,
      freightAmount: 7.5,
      totalAmount: 50,
      deliveryAddress: 'Rua Teste, 123',
      paymentReference: 'CHECKOUT-001',
      paymentLinkId: 'plink-1',
      paymentLinkUrl: 'https://pay.test/plink-1',
      paymentStatus: 'PAID',
      paidAt: new Date('2026-04-24T12:00:00.000Z'),
      createdAt: new Date('2026-04-24T11:00:00.000Z'),
      updatedAt: new Date('2026-04-24T12:05:00.000Z'),
      contactName: 'Cliente Checkout',
      contactPhone: '11999990000',
      abandonmentTouchesCount: 0,
      lastAbandonmentInterval: null,
      lastAbandonmentAt: null,
      couponCode: null,
      discountAmount: null,
      trackingCode: null,
      trackingUrl: null,
      trackingNotifiedAt: null,
    };

    const csv = builder.build([order], {
      dateFrom: new Date('2026-04-24T00:00:00.000Z'),
      dateTo: new Date('2026-04-24T23:59:59.000Z'),
    });

    expect(csv).toContain('"Pedido";"Cliente";"Telefone"');
    expect(csv).toContain('"order-1";"Cliente Checkout";"11999990000"');
    expect(csv).toContain('"42,50";"7,50";"50,00"');
    expect(csv).toContain('"CHECKOUT-001"');
  });
});
