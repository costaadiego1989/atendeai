import { ConfigService } from '@nestjs/config';
import { DashboardAgentFactory, DashboardTenantContext } from '../domain/dashboard-agent/DashboardAgentFactory';

jest.mock('@langchain/langgraph/prebuilt', () => ({
  createReactAgent: jest.fn().mockReturnValue({ invoke: jest.fn(), stream: jest.fn() }),
}));

jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation((config) => ({
    ...config,
    _modelType: 'ChatOpenAI',
  })),
}));

describe('DashboardAgentFactory', () => {
  let factory: DashboardAgentFactory;
  let configService: ConfigService;

  const mockContext: DashboardTenantContext = {
    tenantId: 'tenant-123',
    companyName: 'Loja Teste',
    businessType: 'ECOMMERCE',
    services: 'Roupas, Acessórios',
    operatingHours: { mon: '09:00-18:00' },
    description: 'Loja de roupas online',
    address: 'São Paulo, SP',
    language: 'pt-BR',
  };

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        const map: Record<string, string> = {
          OPENROUTER_DASHBOARD_MODEL: 'anthropic/claude-sonnet-4',
          OPENROUTER_API_KEY: 'test-key',
          OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
        };
        return map[key] || defaultValue;
      }),
    } as any;

    factory = new DashboardAgentFactory(configService);
  });

  it('should create an agent with tools and system prompt', () => {
    const { createReactAgent } = require('@langchain/langgraph/prebuilt');
    const mockTools = [{ name: 'test_tool' }] as any;
    const systemPrompt = 'You are a helpful assistant';

    const agent = factory.create(mockContext, mockTools, systemPrompt);

    expect(createReactAgent).toHaveBeenCalledWith({
      llm: expect.anything(),
      tools: mockTools,
      stateModifier: systemPrompt,
    });
    expect(agent).toBeDefined();
  });

  it('should configure ChatOpenAI with OpenRouter settings', () => {
    const { ChatOpenAI } = require('@langchain/openai');
    const mockTools = [] as any;

    factory.create(mockContext, mockTools, 'prompt');

    expect(ChatOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'anthropic/claude-sonnet-4',
        apiKey: 'test-key',
        configuration: { baseURL: 'https://openrouter.ai/api/v1' },
        streaming: true,
        temperature: 0.3,
      }),
    );
  });

  it('should use default model when env var not set', () => {
    configService.get = jest.fn((key: string, defaultValue?: string) => {
      if (key === 'OPENROUTER_DASHBOARD_MODEL') return defaultValue;
      if (key === 'OPENROUTER_API_KEY') return 'key';
      return defaultValue;
    }) as any;

    const { ChatOpenAI } = require('@langchain/openai');
    factory.create(mockContext, [] as any, 'prompt');

    expect(ChatOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'anthropic/claude-sonnet-4' }),
    );
  });
});
