import { createSchedulingTool } from '../domain/dashboard-agent/tools/SchedulingTool';
import { ISchedulingMetricsProvider } from '../application/ports/dashboard/ISchedulingMetricsProvider';

describe('SchedulingTool', () => {
  let mockProvider: jest.Mocked<ISchedulingMetricsProvider>;

  beforeEach(() => {
    mockProvider = {
      getMetrics: jest.fn().mockResolvedValue({
        occupancyRate: 75,
        totalSlots: 40,
        bookedSlots: 30,
        availableSlots: 10,
        noShows: 2,
        cancellations: 3,
        nextAppointments: [
          { time: '14:00', clientName: 'Ana Silva', service: 'Consulta', professional: 'Dr. Carlos' },
          { time: '15:00', clientName: 'João Souza', service: 'Retorno' },
        ],
        comparisonPrevious: { occupancyRate: 68, percentChange: 10.3 },
      }),
    };
  });

  it('should call provider with tenantId and period', async () => {
    const toolInstance = createSchedulingTool(mockProvider);
    const result = await toolInstance.invoke(
      { period: 'today' },
      { configurable: { tenantId: 'tenant-789' } },
    );

    expect(mockProvider.getMetrics).toHaveBeenCalledWith('tenant-789', 'today');
    const parsed = JSON.parse(result);
    expect(parsed.occupancyRate).toBe(75);
    expect(parsed.nextAppointments).toHaveLength(2);
  });

  it('should return error when tenantId missing', async () => {
    const toolInstance = createSchedulingTool(mockProvider);
    const result = await toolInstance.invoke(
      { period: 'today' },
      { configurable: {} },
    );

    const parsed = JSON.parse(result);
    expect(parsed.error).toContain('tenant');
  });

  it('should handle provider errors', async () => {
    mockProvider.getMetrics.mockRejectedValue(new Error('Scheduling service down'));
    const toolInstance = createSchedulingTool(mockProvider);
    const result = await toolInstance.invoke(
      { period: 'this_week' },
      { configurable: { tenantId: 'tenant-789' } },
    );

    const parsed = JSON.parse(result);
    expect(parsed.error).toContain('Scheduling service down');
  });
});
