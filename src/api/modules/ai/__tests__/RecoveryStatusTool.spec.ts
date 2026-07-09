import { createRecoveryStatusTool } from '../domain/dashboard-agent/tools/RecoveryStatusTool';
import { IRecoveryMetricsProvider } from '../application/ports/dashboard/IRecoveryMetricsProvider';

describe('RecoveryStatusTool', () => {
  let mockProvider: jest.Mocked<IRecoveryMetricsProvider>;

  beforeEach(() => {
    mockProvider = {
      getMetrics: jest.fn().mockResolvedValue({
        totalOpen: 25000,
        totalRecovered: 8500,
        conversionRate: 34,
        topDebtors: [
          { name: 'Carlos Melo', amount: 5000, daysOverdue: 45 },
          { name: 'Ana Ferreira', amount: 3200, daysOverdue: 30 },
        ],
        scheduledCollections: 12,
        comparisonPrevious: {
          totalRecovered: 6000,
          percentChange: 41.7,
        },
      }),
    };
  });

  it('should call provider with tenantId and period', async () => {
    const toolInstance = createRecoveryStatusTool(mockProvider);
    const result = await toolInstance.invoke(
      { period: 'this_month' },
      { configurable: { tenantId: 'tenant-rec' } },
    );

    expect(mockProvider.getMetrics).toHaveBeenCalledWith('tenant-rec', 'this_month');
    const parsed = JSON.parse(result);
    expect(parsed.totalOpen).toBe(25000);
    expect(parsed.totalRecovered).toBe(8500);
    expect(parsed.topDebtors).toHaveLength(2);
  });

  it('should return error when tenantId missing', async () => {
    const toolInstance = createRecoveryStatusTool(mockProvider);
    const result = await toolInstance.invoke(
      { period: 'today' },
      { configurable: {} },
    );

    const parsed = JSON.parse(result);
    expect(parsed.error).toContain('tenant');
  });

  it('should handle provider errors', async () => {
    mockProvider.getMetrics.mockRejectedValue(new Error('Recovery module offline'));
    const toolInstance = createRecoveryStatusTool(mockProvider);
    const result = await toolInstance.invoke(
      { period: 'this_week' },
      { configurable: { tenantId: 'tenant-rec' } },
    );

    const parsed = JSON.parse(result);
    expect(parsed.error).toContain('Recovery module offline');
  });
});
