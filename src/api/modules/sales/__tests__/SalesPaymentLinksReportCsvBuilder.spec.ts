import { SalesPaymentLinksReportCsvBuilder } from '../application/services/SalesPaymentLinksReportCsvBuilder';
import { SalesPaymentLinkRecord } from '../domain/repositories/ISalesRepository';

describe('SalesPaymentLinksReportCsvBuilder', () => {
  it('should build a csv report for sales charges', () => {
    const builder = new SalesPaymentLinksReportCsvBuilder();
    const item: SalesPaymentLinkRecord = {
      id: 'link-1',
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      providerLinkId: 'plink-1',
      externalId: 'sales-charge|tenant-1|link-1',
      name: 'Cobrança consultoria',
      description: 'Projeto mensal',
      label: 'Mensal',
      value: 199.9,
      url: 'https://pay.test/link-1',
      billingType: 'PIX',
      status: 'PAID',
      source: 'MANUAL',
      resourceType: 'PAYMENT',
      contactId: 'contact-1',
      contactName: 'Cliente Sales',
      conversationId: 'conversation-1',
      expiresAt: new Date('2026-04-30T23:59:59.000Z'),
      createdAt: new Date('2026-04-24T10:00:00.000Z'),
      updatedAt: new Date('2026-04-24T11:00:00.000Z'),
      deletedAt: null,
    };

    const csv = builder.build([item], {
      dateFrom: new Date('2026-04-24T00:00:00.000Z'),
      dateTo: new Date('2026-04-24T23:59:59.000Z'),
    });

    expect(csv).toContain('"Cobrança";"Contato";"Status"');
    expect(csv).toContain('"Cobrança consultoria";"Cliente Sales";"PAID"');
    expect(csv).toContain('"199,90"');
    expect(csv).toContain('"https://pay.test/link-1"');
  });
});
