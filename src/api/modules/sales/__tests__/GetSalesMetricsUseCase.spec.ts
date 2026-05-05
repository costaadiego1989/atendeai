import { GetSalesMetricsUseCase } from '../application/use-cases/GetSalesMetricsUseCase';
import { ISalesMetricsRepository } from '../domain/repositories/ISalesRepository';
import { SalesMetric } from '../domain/entities/SalesMetric';

describe('GetSalesMetricsUseCase', () => {
  let useCase: GetSalesMetricsUseCase;
  let salesRepository: jest.Mocked<ISalesMetricsRepository>;

  beforeEach(() => {
    salesRepository = {
      findByTenantAndDate: jest.fn(),
      save: jest.fn(),
      incrementMetric: jest.fn(),
      getMetrics: jest.fn(),
    };

    useCase = new GetSalesMetricsUseCase(salesRepository);
  });

  it('should aggregate summary totals and serialize metric dates', async () => {
    salesRepository.getMetrics.mockResolvedValue([
      SalesMetric.create({
        tenantId: 'tenant-1',
        date: new Date('2026-01-01T00:00:00.000Z'),
        totalMessages: 10,
        purchaseIntents: 3,
        paymentLinksGenerated: 2,
        estimatedRevenue: 500,
      }),
      SalesMetric.create({
        tenantId: 'tenant-1',
        date: new Date('2026-01-02T00:00:00.000Z'),
        totalMessages: 4,
        purchaseIntents: 1,
        paymentLinksGenerated: 1,
        estimatedRevenue: 199,
      }),
    ]);

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-01-31T23:59:59.999Z'),
    });

    expect(salesRepository.getMetrics).toHaveBeenCalledWith(
      'tenant-1',
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-31T23:59:59.999Z'),
    );
    expect(result.metrics).toEqual([
      {
        date: '2026-01-01T00:00:00.000Z',
        totalMessages: 10,
        purchaseIntents: 3,
        paymentLinksGenerated: 2,
        estimatedRevenue: 500,
      },
      {
        date: '2026-01-02T00:00:00.000Z',
        totalMessages: 4,
        purchaseIntents: 1,
        paymentLinksGenerated: 1,
        estimatedRevenue: 199,
      },
    ]);
    expect(result.summary).toEqual({
      totalMessages: 14,
      totalIntents: 4,
      totalLinks: 3,
      totalRevenue: 699,
    });
  });

  it('should return an empty summary when there are no metrics', async () => {
    salesRepository.getMetrics.mockResolvedValue([]);

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-01-31T23:59:59.999Z'),
    });

    expect(result).toEqual({
      metrics: [],
      summary: {
        totalMessages: 0,
        totalIntents: 0,
        totalLinks: 0,
        totalRevenue: 0,
      },
    });
  });
});
