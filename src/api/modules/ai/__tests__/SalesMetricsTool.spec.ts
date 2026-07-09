import { createSalesMetricsTool } from '../domain/dashboard-agent/tools/SalesMetricsTool';
import { IDashboardMetricsProvider } from '../application/ports/dashboard/IDashboardMetricsProvider';

describe('SalesMetricsTool', () => {
  let mockProvider: jest.Mocked<IDashboardMetricsProvider>;

  beforeEach(() => {
    mockProvider = {
      getRevenue: jest.fn().mockResolvedValue({
        totalRevenue: 15000.50,
        count: 42,
        averageTicket: 357.15,
        comparisonPrevious: {
          totalRevenue: 12000,
          count: 35,
          percentChange: 25,
        },
      }),
    };
  });

  it('should call provider with tenantId from configurable', async () => {
    const toolInstance = createSalesMetricsTool(mockProvider);
    const result = await toolInstance.invoke(
      { period: 'this_month' },
      { configurable: { tenantId: 'tenant-123' } },
    );

    expect(mockProvider.getRevenue).toHaveBeenCalledWith('tenant-123', 'this_month', undefined);
    const parsed = JSON.parse(result);
    expect(parsed.totalRevenue).toBe(15000.50);
    expect(parsed.count).toBe(42);
  });

  it('should pass groupBy when provided', async () => {
    const toolInstance = createSalesMetricsTool(mockProvider);
    await toolInstance.invoke(
      { period: 'this_week', groupBy: 'product' },
      { configurable: { tenantId: 'tenant-123' } },
    );

    expect(mockProvider.getRevenue).toHaveBeenCalledWith('tenant-123', 'this_week', 'product');
  });

  it('should return error when tenantId not in configurable', async () => {
    const toolInstance = createSalesMetricsTool(mockProvider);
    const result = await toolInstance.invoke(
      { period: 'today' },
      { configurable: {} },
    );

    const parsed = JSON.parse(result);
    expect(parsed.error).toContain('tenant');
    expect(mockProvider.getRevenue).not.toHaveBeenCalled();
  });

  it('should handle provider errors gracefully', async () => {
    mockProvider.getRevenue.mockRejectedValue(new Error('DB connection failed'));
    const toolInstance = createSalesMetricsTool(mockProvider);
    const result = await toolInstance.invoke(
      { period: 'today' },
      { configurable: { tenantId: 'tenant-123' } },
    );

    const parsed = JSON.parse(result);
    expect(parsed.error).toContain('DB connection failed');
  });
});
