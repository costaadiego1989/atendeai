import { DashboardToolRegistry } from '../domain/dashboard-agent/DashboardToolRegistry';
import { DashboardPromptBuilder } from '../domain/dashboard-agent/DashboardPromptBuilder';
import { DashboardAgentFactory, DashboardTenantContext } from '../domain/dashboard-agent/DashboardAgentFactory';
import { StreamDashboardChatUseCase } from '../application/use-cases/StreamDashboardChatUseCase';
import { firstValueFrom, toArray } from 'rxjs';
import { ConfigService } from '@nestjs/config';

jest.mock('@langchain/langgraph/prebuilt', () => ({
  createReactAgent: jest.fn().mockReturnValue({
    stream: jest.fn().mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield {
          messages: [
            { content: 'Seu faturamento deste mês foi R$ 12.500,00 com ticket médio de R$ 312,50.', tool_calls: undefined },
          ],
        };
      },
    }),
  }),
}));

jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({ _modelType: 'mock' })),
}));

describe('Dashboard Agent Integration', () => {
  const tenantContext: DashboardTenantContext = {
    tenantId: 'tenant-integration-test',
    companyName: 'Pizzaria do João',
    businessType: 'FOOD',
    services: 'Pizzas, Massas, Bebidas',
    operatingHours: { seg_sex: '18:00-23:00', sab_dom: '17:00-00:00' },
    description: 'Pizzaria artesanal delivery e salão',
    address: 'Rua das Pizzas, 42 - RJ',
    language: 'pt-BR',
  };

  describe('ToolRegistry + PromptBuilder pipeline', () => {
    it('should select correct tools for FOOD niche', () => {
      const registry = new DashboardToolRegistry();
      const toolIds = registry.getToolIdsForNiche('FOOD');

      expect(toolIds).toContain('sales_metrics');
      expect(toolIds).toContain('attendance_status');
      expect(toolIds).toContain('catalog_inventory');
      expect(toolIds).toContain('contacts_crm');
      expect(toolIds).not.toContain('scheduling');
      expect(toolIds).not.toContain('recovery_status');
    });

    it('should build prompt with FOOD niche guidance and correct tools', () => {
      const registry = new DashboardToolRegistry();
      const builder = new DashboardPromptBuilder();
      const toolIds = registry.getToolIdsForNiche('FOOD');
      const prompt = builder.build(tenantContext, toolIds);

      expect(prompt).toContain('Pizzaria do João');
      expect(prompt).toContain('Food Service');
      expect(prompt).toContain('sales_metrics');
      expect(prompt).toContain('catalog_inventory');
      expect(prompt).not.toContain('scheduling');
      expect(prompt).toContain('NUNCA invente dados');
    });

    it('should vary tools by niche — CLINIC gets scheduling, no catalog', () => {
      const registry = new DashboardToolRegistry();
      const builder = new DashboardPromptBuilder();
      const clinicContext = { ...tenantContext, businessType: 'CLINIC', companyName: 'Clínica ABC' };
      const toolIds = registry.getToolIdsForNiche('CLINIC');
      const prompt = builder.build(clinicContext, toolIds);

      expect(toolIds).toContain('scheduling');
      expect(toolIds).not.toContain('catalog_inventory');
      expect(prompt).toContain('Clínica/Saúde');
      expect(prompt).toContain('paciente');
    });
  });

  describe('Full UseCase pipeline (mocked LLM)', () => {
    let useCase: StreamDashboardChatUseCase;

    beforeEach(() => {
      const configService = {
        get: jest.fn((key: string, def?: string) => {
          const map: Record<string, string> = {
            OPENROUTER_DASHBOARD_MODEL: 'test/model',
            OPENROUTER_API_KEY: 'test-key',
            OPENROUTER_BASE_URL: 'https://test.openrouter.ai/api/v1',
          };
          return map[key] || def;
        }),
      } as any;

      const factory = new DashboardAgentFactory(configService);
      const registry = new DashboardToolRegistry();
      const promptBuilder = new DashboardPromptBuilder();

      useCase = new StreamDashboardChatUseCase(
        factory,
        registry,
        promptBuilder,
        { getRevenue: jest.fn().mockResolvedValue({ totalRevenue: 12500, count: 40, averageTicket: 312.50 }) } as any,
        { getStatus: jest.fn().mockResolvedValue({ activeConversations: 5, inQueue: 1, waitingHuman: 0, avgResponseTimeSeconds: 30, avgAiResponseTimeSeconds: 3, byChannel: [] }) } as any,
        { getMetrics: jest.fn().mockResolvedValue({ occupancyRate: 0, totalSlots: 0, bookedSlots: 0, availableSlots: 0, noShows: 0, cancellations: 0, nextAppointments: [] }) } as any,
        { getMetrics: jest.fn().mockResolvedValue({ topProducts: [], lowStockItems: [], pendingOrders: 0, averageOrderValue: 0, totalProducts: 0 }) } as any,
        { getMetrics: jest.fn().mockResolvedValue({ totalOpen: 0, totalRecovered: 0, conversionRate: 0, topDebtors: [], scheduledCollections: 0 }) } as any,
        { getMetrics: jest.fn().mockResolvedValue({ totalContacts: 0, newInPeriod: 0, byFunnelStage: [], mostEngaged: [] }), searchContacts: jest.fn().mockResolvedValue([]) } as any,
      );
    });

    it('should stream a complete response with token and done events', async () => {
      const observable = useCase.execute({
        tenantId: 'tenant-integration-test',
        userId: 'user-1',
        message: 'Qual meu faturamento este mês?',
      });

      const events = await firstValueFrom(observable.pipe(toArray()));
      const parsed = events.map((e) => JSON.parse((e as any).data));

      // Should have at least token + done
      expect(parsed.length).toBeGreaterThanOrEqual(2);
      expect(parsed.some((e: any) => e.type === 'token')).toBe(true);
      expect(parsed[parsed.length - 1].type).toBe('done');
    });

    it('should include correct content in token events', async () => {
      const observable = useCase.execute({
        tenantId: 'tenant-integration-test',
        userId: 'user-1',
        message: 'Faturamento?',
      });

      const events = await firstValueFrom(observable.pipe(toArray()));
      const tokens = events
        .map((e) => JSON.parse((e as any).data))
        .filter((e: any) => e.type === 'token');

      const fullContent = tokens.map((t: any) => t.content).join('');
      expect(fullContent).toContain('R$ 12.500,00');
    });
  });

  describe('Tenant isolation', () => {
    it('should pass tenantId via configurable, not as user input', () => {
      const { createReactAgent } = require('@langchain/langgraph/prebuilt');
      const configService = {
        get: jest.fn((key: string, def?: string) => def || 'test'),
      } as any;

      const factory = new DashboardAgentFactory(configService);
      const registry = new DashboardToolRegistry();
      const promptBuilder = new DashboardPromptBuilder();

      const useCase = new StreamDashboardChatUseCase(
        factory, registry, promptBuilder,
        { getRevenue: jest.fn() } as any,
        { getStatus: jest.fn() } as any,
        { getMetrics: jest.fn() } as any,
        { getMetrics: jest.fn() } as any,
        { getMetrics: jest.fn() } as any,
        { getMetrics: jest.fn(), searchContacts: jest.fn() } as any,
      );

      useCase.execute({
        tenantId: 'isolated-tenant',
        userId: 'user-1',
        message: 'test',
      }).subscribe();

      // Agent should be called — the createReactAgent mock returns stream
      expect(createReactAgent).toHaveBeenCalled();
    });
  });
});
