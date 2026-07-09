import { StreamDashboardChatUseCase } from '../application/use-cases/StreamDashboardChatUseCase';
import { DashboardAgentFactory } from '../domain/dashboard-agent/DashboardAgentFactory';
import { DashboardToolRegistry } from '../domain/dashboard-agent/DashboardToolRegistry';
import { DashboardPromptBuilder } from '../domain/dashboard-agent/DashboardPromptBuilder';
import { firstValueFrom, toArray } from 'rxjs';

describe('StreamDashboardChatUseCase', () => {
  let useCase: StreamDashboardChatUseCase;
  let mockAgentFactory: jest.Mocked<DashboardAgentFactory>;
  let mockToolRegistry: DashboardToolRegistry;
  let mockPromptBuilder: DashboardPromptBuilder;
  let mockAgent: any;

  beforeEach(() => {
    mockAgent = {
      stream: jest.fn().mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            messages: [{ content: 'Seu faturamento hoje foi R$ 5.000,00.', tool_calls: undefined }],
          };
        },
      }),
    };

    mockAgentFactory = {
      create: jest.fn().mockReturnValue(mockAgent),
    } as any;

    mockToolRegistry = new DashboardToolRegistry();
    mockPromptBuilder = new DashboardPromptBuilder();

    useCase = new StreamDashboardChatUseCase(
      mockAgentFactory,
      mockToolRegistry,
      mockPromptBuilder,
      { getRevenue: jest.fn() } as any,
      { getStatus: jest.fn() } as any,
      { getMetrics: jest.fn() } as any,
      { getMetrics: jest.fn() } as any,
      { getMetrics: jest.fn() } as any,
      { getMetrics: jest.fn(), searchContacts: jest.fn() } as any,
    );
  });

  it('should create agent with correct tenant context and tools', async () => {
    const observable = useCase.execute({
      tenantId: 'tenant-1',
      userId: 'user-1',
      message: 'Qual meu faturamento hoje?',
    });

    const events = await firstValueFrom(observable.pipe(toArray()));

    expect(mockAgentFactory.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1' }),
      expect.any(Array),
      expect.any(String),
    );
  });

  it('should emit token events from agent stream', async () => {
    const observable = useCase.execute({
      tenantId: 'tenant-1',
      userId: 'user-1',
      message: 'Qual meu faturamento?',
    });

    const events = await firstValueFrom(observable.pipe(toArray()));
    const parsed = events.map((e) => JSON.parse((e as any).data));

    expect(parsed.some((e: any) => e.type === 'token')).toBe(true);
    expect(parsed[parsed.length - 1].type).toBe('done');
  });

  it('should emit error event on stream failure', async () => {
    mockAgent.stream.mockRejectedValue(new Error('LLM unavailable'));

    const observable = useCase.execute({
      tenantId: 'tenant-1',
      userId: 'user-1',
      message: 'test',
    });

    const events = await firstValueFrom(observable.pipe(toArray()));
    const parsed = events.map((e) => JSON.parse((e as any).data));

    expect(parsed.some((e: any) => e.type === 'error')).toBe(true);
    expect(parsed[parsed.length - 1].type).toBe('done');
  });
});
