import { TrackSalesMetricUseCase } from '../application/use-cases/TrackSalesMetricUseCase';
import { ISalesMetricsRepository } from '../domain/repositories/ISalesRepository';

describe('TrackSalesMetricUseCase', () => {
  let useCase: TrackSalesMetricUseCase;
  let salesRepository: jest.Mocked<ISalesMetricsRepository>;

  beforeEach(() => {
    salesRepository = {
      findByTenantAndDate: jest.fn(),
      save: jest.fn(),
      incrementMetric: jest.fn(),
      getMetrics: jest.fn(),
    };

    useCase = new TrackSalesMetricUseCase(salesRepository);
  });

  it('should delegate the metric increment with the current date', async () => {
    salesRepository.incrementMetric.mockResolvedValue();

    await useCase.execute({
      tenantId: 'tenant-1',
      type: 'MESSAGE',
    });

    expect(salesRepository.incrementMetric).toHaveBeenCalledWith(
      'tenant-1',
      expect.any(Date),
      'MESSAGE',
      undefined,
    );
  });

  it('should forward the optional value for LINK metrics', async () => {
    salesRepository.incrementMetric.mockResolvedValue();

    await useCase.execute({
      tenantId: 'tenant-1',
      type: 'LINK',
      value: 299,
    });

    expect(salesRepository.incrementMetric).toHaveBeenCalledWith(
      'tenant-1',
      expect.any(Date),
      'LINK',
      299,
    );
  });
});
