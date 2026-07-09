import { createCatalogInventoryTool } from '../domain/dashboard-agent/tools/CatalogInventoryTool';
import { ICatalogMetricsProvider } from '../application/ports/dashboard/ICatalogMetricsProvider';

describe('CatalogInventoryTool', () => {
  let mockProvider: jest.Mocked<ICatalogMetricsProvider>;

  beforeEach(() => {
    mockProvider = {
      getMetrics: jest.fn().mockResolvedValue({
        topProducts: [
          { name: 'Pizza Margherita', sold: 120, revenue: 4800 },
          { name: 'Coca-Cola 600ml', sold: 200, revenue: 1400 },
        ],
        lowStockItems: [
          { name: 'Mussarela', currentStock: 2, threshold: 10 },
        ],
        pendingOrders: 5,
        averageOrderValue: 67.50,
        totalProducts: 45,
      }),
    };
  });

  it('should call provider with tenantId and period', async () => {
    const toolInstance = createCatalogInventoryTool(mockProvider);
    const result = await toolInstance.invoke(
      { period: 'this_week' },
      { configurable: { tenantId: 'tenant-food' } },
    );

    expect(mockProvider.getMetrics).toHaveBeenCalledWith('tenant-food', 'this_week');
    const parsed = JSON.parse(result);
    expect(parsed.topProducts).toHaveLength(2);
    expect(parsed.lowStockItems).toHaveLength(1);
    expect(parsed.pendingOrders).toBe(5);
  });

  it('should return error when tenantId missing', async () => {
    const toolInstance = createCatalogInventoryTool(mockProvider);
    const result = await toolInstance.invoke(
      { period: 'today' },
      { configurable: {} },
    );

    const parsed = JSON.parse(result);
    expect(parsed.error).toContain('tenant');
  });

  it('should handle provider errors', async () => {
    mockProvider.getMetrics.mockRejectedValue(new Error('Catalog table missing'));
    const toolInstance = createCatalogInventoryTool(mockProvider);
    const result = await toolInstance.invoke(
      { period: 'today' },
      { configurable: { tenantId: 'tenant-food' } },
    );

    const parsed = JSON.parse(result);
    expect(parsed.error).toContain('Catalog table missing');
  });
});
