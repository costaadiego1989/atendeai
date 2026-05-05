import { SalesMetric } from '../domain/entities/SalesMetric';

describe('SalesMetric', () => {
  it('should increment total messages and refresh updatedAt', () => {
    const metric = SalesMetric.create({
      tenantId: 'tenant-1',
      date: new Date('2026-01-01T00:00:00.000Z'),
      totalMessages: 0,
      purchaseIntents: 0,
      paymentLinksGenerated: 0,
      estimatedRevenue: 0,
    });

    metric.incrementMessages();

    expect(metric.totalMessages).toBe(1);
  });

  it('should increment purchase intents', () => {
    const metric = SalesMetric.create({
      tenantId: 'tenant-1',
      date: new Date('2026-01-01T00:00:00.000Z'),
      totalMessages: 1,
      purchaseIntents: 0,
      paymentLinksGenerated: 0,
      estimatedRevenue: 0,
    });

    metric.incrementIntents();

    expect(metric.purchaseIntents).toBe(1);
  });

  it('should increment links and accumulate estimated revenue', () => {
    const metric = SalesMetric.create({
      tenantId: 'tenant-1',
      date: new Date('2026-01-01T00:00:00.000Z'),
      totalMessages: 1,
      purchaseIntents: 1,
      paymentLinksGenerated: 0,
      estimatedRevenue: 100,
    });

    metric.incrementLinks(299);

    expect(metric.paymentLinksGenerated).toBe(1);
    expect(metric.estimatedRevenue).toBe(399);
  });
});
