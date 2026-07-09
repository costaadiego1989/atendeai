import { createContactsCRMTool } from '../domain/dashboard-agent/tools/ContactsCRMTool';
import { IContactMetricsProvider } from '../application/ports/dashboard/IContactMetricsProvider';

describe('ContactsCRMTool', () => {
  let mockProvider: jest.Mocked<IContactMetricsProvider>;

  beforeEach(() => {
    mockProvider = {
      getMetrics: jest.fn().mockResolvedValue({
        totalContacts: 350,
        newInPeriod: 28,
        byFunnelStage: [
          { stage: 'lead', count: 120 },
          { stage: 'qualified', count: 80 },
          { stage: 'customer', count: 150 },
        ],
        mostEngaged: [
          { name: 'Pedro Lima', phone: '11999998888', lastInteraction: '2026-07-08' },
        ],
      }),
      searchContacts: jest.fn().mockResolvedValue([
        { id: 'c-1', name: 'Maria Costa', phone: '21988887777' },
      ]),
    };
  });

  it('should return metrics when action is metrics', async () => {
    const toolInstance = createContactsCRMTool(mockProvider);
    const result = await toolInstance.invoke(
      { action: 'metrics', period: 'this_month' },
      { configurable: { tenantId: 'tenant-crm' } },
    );

    expect(mockProvider.getMetrics).toHaveBeenCalledWith('tenant-crm', 'this_month');
    const parsed = JSON.parse(result);
    expect(parsed.totalContacts).toBe(350);
    expect(parsed.byFunnelStage).toHaveLength(3);
  });

  it('should search contacts when action is search', async () => {
    const toolInstance = createContactsCRMTool(mockProvider);
    const result = await toolInstance.invoke(
      { action: 'search', query: 'Maria' },
      { configurable: { tenantId: 'tenant-crm' } },
    );

    expect(mockProvider.searchContacts).toHaveBeenCalledWith('tenant-crm', 'Maria', 10);
    const parsed = JSON.parse(result);
    expect(parsed.searchResults).toHaveLength(1);
    expect(parsed.searchResults[0].name).toBe('Maria Costa');
  });

  it('should return error when tenantId missing', async () => {
    const toolInstance = createContactsCRMTool(mockProvider);
    const result = await toolInstance.invoke(
      { action: 'metrics' },
      { configurable: {} },
    );

    const parsed = JSON.parse(result);
    expect(parsed.error).toContain('tenant');
  });

  it('should handle provider errors gracefully', async () => {
    mockProvider.getMetrics.mockRejectedValue(new Error('Contact DB timeout'));
    const toolInstance = createContactsCRMTool(mockProvider);
    const result = await toolInstance.invoke(
      { action: 'metrics', period: 'today' },
      { configurable: { tenantId: 'tenant-crm' } },
    );

    const parsed = JSON.parse(result);
    expect(parsed.error).toContain('Contact DB timeout');
  });
});
