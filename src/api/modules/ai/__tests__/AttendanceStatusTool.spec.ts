import { createAttendanceStatusTool } from '../domain/dashboard-agent/tools/AttendanceStatusTool';
import { IAttendanceMetricsProvider } from '../application/ports/dashboard/IAttendanceMetricsProvider';

describe('AttendanceStatusTool', () => {
  let mockProvider: jest.Mocked<IAttendanceMetricsProvider>;

  beforeEach(() => {
    mockProvider = {
      getStatus: jest.fn().mockResolvedValue({
        activeConversations: 12,
        inQueue: 3,
        waitingHuman: 2,
        avgResponseTimeSeconds: 45,
        avgAiResponseTimeSeconds: 5,
        byChannel: [
          { channel: 'whatsapp', count: 10 },
          { channel: 'instagram', count: 2 },
        ],
        byAgent: [
          { agentName: 'Maria', activeCount: 5 },
          { agentName: 'João', activeCount: 4 },
        ],
      }),
    };
  });

  it('should call provider with tenantId from configurable', async () => {
    const toolInstance = createAttendanceStatusTool(mockProvider);
    const result = await toolInstance.invoke(
      {},
      { configurable: { tenantId: 'tenant-456' } },
    );

    expect(mockProvider.getStatus).toHaveBeenCalledWith('tenant-456');
    const parsed = JSON.parse(result);
    expect(parsed.activeConversations).toBe(12);
    expect(parsed.inQueue).toBe(3);
    expect(parsed.byChannel).toHaveLength(2);
  });

  it('should return error when tenantId missing', async () => {
    const toolInstance = createAttendanceStatusTool(mockProvider);
    const result = await toolInstance.invoke({}, { configurable: {} });

    const parsed = JSON.parse(result);
    expect(parsed.error).toContain('tenant');
    expect(mockProvider.getStatus).not.toHaveBeenCalled();
  });

  it('should handle provider errors gracefully', async () => {
    mockProvider.getStatus.mockRejectedValue(new Error('Redis unavailable'));
    const toolInstance = createAttendanceStatusTool(mockProvider);
    const result = await toolInstance.invoke(
      {},
      { configurable: { tenantId: 'tenant-456' } },
    );

    const parsed = JSON.parse(result);
    expect(parsed.error).toContain('Redis unavailable');
  });
});
