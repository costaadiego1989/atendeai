import { ProcessAIResponseUseCase } from '../application/use-cases/ProcessAIResponseUseCase';
import { ProcessAIResponseService } from '../application/services/ProcessAIResponseService';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import { IAIEngine } from '../application/ports/IAIEngine';
import { IEventBus } from '@shared/application/ports/IEventBus';
import { ITenantRepository } from '@modules/tenant/domain/repositories/ITenantRepository';
import { IChatHistoryRepository } from '../application/ports/IChatHistoryRepository';
import { ICheckQuotaUseCase } from '@modules/billing/application/use-cases/interfaces/ICheckQuotaUseCase';
import { AIResponseProcessor } from '../application/services/AIResponseProcessor';
import { HumanHandoffPolicy } from '../application/services/HumanHandoffPolicy';
import { AdvanceCommerceConversationUseCase } from '@modules/commerce/application/use-cases/AdvanceCommerceConversationUseCase';
import { Tenant } from '@modules/tenant/domain/entities/Tenant';
import { User } from '@modules/tenant/domain/entities/User';
import { CompanyName } from '@modules/tenant/domain/value-objects/CompanyName';
import { CNPJ } from '@modules/tenant/domain/value-objects/CNPJ';
import { Plan } from '@modules/tenant/domain/value-objects/Plan';
import { Email } from '@modules/tenant/domain/value-objects/Email';
import { Phone } from '@modules/tenant/domain/value-objects/Phone';
import { Role } from '@modules/tenant/domain/value-objects/Role';
import { AIConfig } from '@modules/tenant/domain/entities/AIConfig';
import {
  AISafetyBlockedIntegrationEvent,
  AIEscalationRequestedIntegrationEvent,
  AIQuotaDeniedIntegrationEvent,
  AIResponseFailedIntegrationEvent,
  AIResponseGeneratedIntegrationEvent,
} from '../application/integration-events/publishers/AIIntegrationEvents';
import { AISessionService } from '../application/services/AISessionService';
import { AIContextAggregator } from '../application/services/AIContextAggregator';
import { IContactRepository } from '@modules/contact/domain/repositories/IContactRepository';
import { TenantAgentRuleService } from '@modules/agent-rules/application/services/TenantAgentRuleService';
import { AiSafetyGate } from '../application/services/AiSafetyGate';

function makeTenant() {
  const tenant = Tenant.create({
    companyName: CompanyName.create('AI Test Company'),
    cnpj: CNPJ.create('60.701.190/0001-04'),
    plan: Plan.create('PROFISSIONAL'),
    users: [
      User.create({
        name: 'Owner User',
        email: Email.create('owner@ai-test.com'),
        phone: Phone.create('11999998888'),
        passwordHash: 'hash',
        role: Role.create('OWNER'),
      }),
    ],
  });

  tenant.configureAI(
    AIConfig.create({
      systemPrompt: 'You are a very helpful AI seller.',
      tone: 'FRIENDLY',
      language: 'pt-BR',
      maxTokensPerResponse: 1200,
      confidenceThreshold: 0.75,
      escalationMessage: 'Vou transferir voce para um humano.',
      businessRules: ['Sempre buscar o proximo passo'],
    }),
  );
  tenant.clearEvents();

  return tenant;
}

describe('ProcessAIResponseUseCase', () => {
  let useCase: ProcessAIResponseUseCase;
  let aiEngine: jest.Mocked<IAIEngine>;
  let eventBus: jest.Mocked<IEventBus>;
  let tenantRepository: jest.Mocked<ITenantRepository>;
  let chatHistoryRepository: jest.Mocked<IChatHistoryRepository>;
  let checkQuotaUseCase: jest.Mocked<ICheckQuotaUseCase>;
  let responseProcessor: jest.Mocked<AIResponseProcessor>;
  let humanHandoffPolicy: jest.Mocked<HumanHandoffPolicy>;
  let advanceCommerceConversationUseCase: jest.Mocked<AdvanceCommerceConversationUseCase>;
  let aiSessionService: jest.Mocked<AISessionService>;
  let contextAggregator: jest.Mocked<AIContextAggregator>;
  let contactRepository: jest.Mocked<IContactRepository>;
  let tenantAgentRuleService: jest.Mocked<TenantAgentRuleService>;

  beforeEach(() => {
    aiEngine = {
      generateResponse: jest.fn(),
    };

    eventBus = {
      publish: jest.fn(),
      subscribe: jest.fn(),
    };

    tenantRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByCnpj: jest.fn(),
      findByWhatsAppNumber: jest.fn(),
      findByApiKey: jest.fn(),
      findAll: jest.fn(),
      exists: jest.fn(),
      listBranches: jest.fn(),
      createBranch: jest.fn(),
      updateBranch: jest.fn(),
      deleteBranch: jest.fn(),
    };

    chatHistoryRepository = {
      getHistory: jest.fn(),
      saveMessage: jest.fn(),
      clearHistory: jest.fn(),
    };

    checkQuotaUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ICheckQuotaUseCase>;

    responseProcessor = {
      process: jest.fn(),
    } as unknown as jest.Mocked<AIResponseProcessor>;

    humanHandoffPolicy = {
      evaluate: jest.fn(),
    } as unknown as jest.Mocked<HumanHandoffPolicy>;

    advanceCommerceConversationUseCase = {
      execute: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<AdvanceCommerceConversationUseCase>;

    aiSessionService = {
      getOrCreateSession: jest.fn().mockResolvedValue({ id: 'session-1' }),
      recordMessage: jest.fn(),
      closeSession: jest.fn(),
    } as unknown as jest.Mocked<AISessionService>;

    contextAggregator = {
      aggregate: jest.fn().mockResolvedValue({
        systemPrompt: 'system prompt',
        diagnostics: {},
      }),
    } as unknown as jest.Mocked<AIContextAggregator>;

    contactRepository = {
      save: jest.fn(),
      findById: jest.fn().mockResolvedValue(null),
      findByPhone: jest.fn(),
      findAllByTenant: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<IContactRepository>;

    tenantAgentRuleService = {
      getRule: jest.fn().mockResolvedValue(null),
      setRule: jest.fn(),
    } as unknown as jest.Mocked<TenantAgentRuleService>;

    const aiSafetyGate = new AiSafetyGate({
      safetyModeEnabled: false,
      blockedSubstrings: [],
      platformSystemAppend: '',
    });

    const service = new ProcessAIResponseService(
      aiEngine,
      eventBus,
      tenantRepository,
      chatHistoryRepository,
      checkQuotaUseCase,
      responseProcessor,
      humanHandoffPolicy,
      advanceCommerceConversationUseCase,
      aiSessionService,
      contextAggregator,
      contactRepository,
      tenantAgentRuleService,
      aiSafetyGate,
    );
    useCase = new ProcessAIResponseUseCase(service);
  });

  it('should throw when tenant does not exist', async () => {
    tenantRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        tenantId: 'missing-tenant',
        conversationId: 'conversation-1',
        contactId: 'contact-1',
        content: { type: 'TEXT', text: 'Oi' },
      }),
    ).rejects.toThrow(EntityNotFoundException);
  });

  it('should return quota exceeded without calling the AI provider', async () => {
    tenantRepository.findById.mockResolvedValue(makeTenant());
    checkQuotaUseCase.execute.mockResolvedValue({
      canProceed: false,
      used: 100,
      quota: 100,
      status: 'ACTIVE',
    });

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      conversationId: 'conversation-1',
      contactId: 'contact-1',
      content: { type: 'TEXT', text: 'Oi' },
    });

    expect(result).toEqual({
      success: false,
      error: 'QUOTA_EXCEEDED',
      message: 'Limite de uso atingido.',
    });
    expect(aiEngine.generateResponse).not.toHaveBeenCalled();
    expect(chatHistoryRepository.saveMessage).not.toHaveBeenCalled();
    // publishes AIQuotaDenied + AIResponseFailed (fallback to DB)
    expect(eventBus.publish).toHaveBeenCalledTimes(2);
    expect(eventBus.publish.mock.calls[0][0]).toBeInstanceOf(
      AIQuotaDeniedIntegrationEvent,
    );
  });

  it('should return NO_SUBSCRIPTION error when subscription does not exist', async () => {
    tenantRepository.findById.mockResolvedValue(makeTenant());
    checkQuotaUseCase.execute.mockResolvedValue({
      canProceed: false,
      used: 0,
      quota: 0,
      status: 'NO_SUBSCRIPTION',
    });

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      conversationId: 'conversation-1',
      contactId: 'contact-1',
      content: { type: 'TEXT', text: 'Oi' },
    });

    expect(result).toEqual({
      success: false,
      error: 'NO_SUBSCRIPTION',
      message: 'Conta em configuração. Tente novamente em instantes.',
    });
    expect(aiEngine.generateResponse).not.toHaveBeenCalled();
    // publishes AIQuotaDenied + AIResponseFailed (fallback to DB)
    expect(eventBus.publish).toHaveBeenCalledTimes(2);
    expect(eventBus.publish.mock.calls[0][0]).toBeInstanceOf(
      AIQuotaDeniedIntegrationEvent,
    );
  });

  it('should return SUBSCRIPTION_INACTIVE error when subscription is not active', async () => {
    tenantRepository.findById.mockResolvedValue(makeTenant());
    checkQuotaUseCase.execute.mockResolvedValue({
      canProceed: false,
      used: 0,
      quota: 1000,
      status: 'OVERDUE',
    });

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      conversationId: 'conversation-1',
      contactId: 'contact-1',
      content: { type: 'TEXT', text: 'Oi' },
    });

    expect(result).toEqual({
      success: false,
      error: 'SUBSCRIPTION_INACTIVE',
      message: 'Assinatura inativa.',
    });
    expect(aiEngine.generateResponse).not.toHaveBeenCalled();
    // publishes AIQuotaDenied + AIResponseFailed (fallback to DB)
    expect(eventBus.publish).toHaveBeenCalledTimes(2);
    expect(eventBus.publish.mock.calls[0][0]).toBeInstanceOf(
      AIQuotaDeniedIntegrationEvent,
    );
  });

  it('bloqueia mensagem segundo modo seguranca e publica integracao', async () => {
    const blockingGate = new AiSafetyGate({
      safetyModeEnabled: true,
      blockedSubstrings: ['palavra_bloqueada'],
      platformSystemAppend: '',
    });

    const service = new ProcessAIResponseService(
      aiEngine,
      eventBus,
      tenantRepository,
      chatHistoryRepository,
      checkQuotaUseCase,
      responseProcessor,
      humanHandoffPolicy,
      advanceCommerceConversationUseCase,
      aiSessionService,
      contextAggregator,
      contactRepository,
      tenantAgentRuleService,
      blockingGate,
    );
    const localUseCase = new ProcessAIResponseUseCase(service);

    tenantRepository.findById.mockResolvedValue(makeTenant());
    checkQuotaUseCase.execute.mockResolvedValue({
      canProceed: true,
      used: 0,
      quota: 1000,
      status: 'ACTIVE',
    });

    const result = await localUseCase.execute({
      tenantId: 'tenant-1',
      conversationId: 'conversation-1',
      contactId: 'contact-1',
      content: { type: 'TEXT', text: 'Contem palavra_bloqueada aqui.' },
    });

    expect(result).toEqual({
      success: false,
      error: 'SAFETY_BLOCKED',
      message: 'A mensagem nao pode ser processada neste momento.',
    });
    expect(aiEngine.generateResponse).not.toHaveBeenCalled();
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    expect(eventBus.publish.mock.calls[0][0]).toBeInstanceOf(
      AISafetyBlockedIntegrationEvent,
    );
  });

  it('should process a normal AI response, persist chat history and publish event', async () => {
    const tenant = makeTenant();
    tenantRepository.findById.mockResolvedValue(tenant);
    checkQuotaUseCase.execute.mockResolvedValue({
      canProceed: true,
      used: 10,
      quota: 1000,
      status: 'ACTIVE',
    });
    chatHistoryRepository.getHistory.mockResolvedValue([
      { role: 'system', content: 'ignore me', timestamp: new Date() },
      { role: 'user', content: 'historico user', timestamp: new Date() },
      {
        role: 'assistant',
        content: 'historico assistant',
        timestamp: new Date(),
      },
    ]);
    aiEngine.generateResponse.mockResolvedValue({
      text: 'Resposta original',
      tokensUsed: 42,
      confidence: 0.91,
      finishReason: 'stop',
      intent: 'PURCHASE',
      sentiment: 'POSITIVE',
    });
    humanHandoffPolicy.evaluate.mockReturnValue({ shouldHandoff: false });
    responseProcessor.process.mockResolvedValue('Resposta processada');

    const result = await useCase.execute({
      tenantId: tenant.id.toString(),
      conversationId: 'conversation-1',
      contactId: 'contact-1',
      content: { type: 'TEXT', text: 'Quero comprar' },
    });

    expect(result).toEqual({ success: true });
    expect(contextAggregator.aggregate).toHaveBeenCalledWith(
      tenant,
      'conversation-1',
      'Quero comprar',
      false,
    );
    expect(aiEngine.generateResponse).toHaveBeenCalledWith({
      systemPrompt: 'system prompt',
      userMessage: 'Quero comprar',
      contextHistory: [
        { role: 'user', content: 'historico user' },
        { role: 'assistant', content: 'historico assistant' },
      ],
      maxTokens: 1200,
      trace: {
        tenantId: tenant.id.toString(),
        conversationId: 'conversation-1',
      },
    });
    expect(responseProcessor.process).toHaveBeenCalledWith(
      'Resposta original',
      {
        tenantId: tenant.id.toString(),
        branchId: null,
        contactId: 'contact-1',
        conversationId: 'conversation-1',
      },
    );
    expect(chatHistoryRepository.saveMessage).toHaveBeenCalledTimes(2);
    expect(aiSessionService.recordMessage).toHaveBeenCalledTimes(2);
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    expect(eventBus.publish.mock.calls[0][0]).toBeInstanceOf(
      AIResponseGeneratedIntegrationEvent,
    );
  });

  it('should escalate to human, persist escalation message and publish escalation event', async () => {
    const tenant = makeTenant();
    tenantRepository.findById.mockResolvedValue(tenant);
    checkQuotaUseCase.execute.mockResolvedValue({
      canProceed: true,
      used: 10,
      quota: 1000,
      status: 'ACTIVE',
    });
    chatHistoryRepository.getHistory.mockResolvedValue([]);
    aiEngine.generateResponse.mockResolvedValue({
      text: 'Resposta sensivel',
      tokensUsed: 22,
      confidence: 0.4,
      finishReason: 'stop',
      intent: 'COMPLAINT',
      sentiment: 'NEGATIVE',
    });
    humanHandoffPolicy.evaluate.mockReturnValue({
      shouldHandoff: true,
      reason: 'LOW_CONFIDENCE',
    });

    const result = await useCase.execute({
      tenantId: tenant.id.toString(),
      conversationId: 'conversation-1',
      contactId: 'contact-1',
      content: { type: 'TEXT', text: 'Quero falar com humano' },
    });

    expect(result).toEqual({
      success: false,
      error: 'HANDOFF_REQUIRED',
      message: 'Escalated to human.',
    });
    expect(aiEngine.generateResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: 'system prompt',
      }),
    );
    expect(responseProcessor.process).not.toHaveBeenCalled();
    expect(eventBus.publish.mock.calls[0][0]).toBeInstanceOf(
      AIEscalationRequestedIntegrationEvent,
    );
  });

  it('should save a fallback message when AI provider fails', async () => {
    const tenant = makeTenant();
    tenantRepository.findById.mockResolvedValue(tenant);
    checkQuotaUseCase.execute.mockResolvedValue({
      canProceed: true,
      used: 10,
      quota: 1000,
      status: 'ACTIVE',
    });
    chatHistoryRepository.getHistory.mockResolvedValue([]);
    aiEngine.generateResponse.mockRejectedValue(new Error('provider down'));

    const result = await useCase.execute({
      tenantId: tenant.id.toString(),
      conversationId: 'conversation-1',
      contactId: 'contact-1',
      content: { type: 'TEXT', text: 'Oi' },
    });

    expect(result).toEqual({
      success: false,
      error: 'AI_PROVIDER_ERROR',
      message: 'provider down',
    });
    expect(eventBus.publish.mock.calls[0][0]).toBeInstanceOf(
      AIResponseFailedIntegrationEvent,
    );
  });

  it('should append scheduling context when the user asks about an appointment category', async () => {
    const tenant = makeTenant();
    tenantRepository.findById.mockResolvedValue(tenant);
    checkQuotaUseCase.execute.mockResolvedValue({
      canProceed: true,
      used: 10,
      quota: 1000,
      status: 'ACTIVE',
    });
    contextAggregator.aggregate.mockResolvedValue({
      systemPrompt:
        'system prompt\n\nScheduling context:\n- Category: Clareamento',
      diagnostics: {},
    });
    chatHistoryRepository.getHistory.mockResolvedValue([]);
    aiEngine.generateResponse.mockResolvedValue({
      text: 'Temos clareamento com a Dra. Ana as 14h.',
      tokensUsed: 33,
      confidence: 0.95,
      finishReason: 'stop',
      intent: 'QUESTION',
      sentiment: 'POSITIVE',
    });
    humanHandoffPolicy.evaluate.mockReturnValue({ shouldHandoff: false });
    responseProcessor.process.mockResolvedValue(
      'Temos clareamento com a Dra. Ana as 14h.',
    );

    const result = await useCase.execute({
      tenantId: tenant.id.toString(),
      conversationId: 'conversation-1',
      contactId: 'contact-1',
      content: { type: 'TEXT', text: 'Tem clareamento amanha?' },
    });

    expect(result).toEqual({ success: true });
    expect(aiEngine.generateResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining('Scheduling context:'),
      }),
    );
  });

  it('should append inventory context when the user asks about a product price or availability', async () => {
    const tenant = makeTenant();
    tenantRepository.findById.mockResolvedValue(tenant);
    checkQuotaUseCase.execute.mockResolvedValue({
      canProceed: true,
      used: 10,
      quota: 1000,
      status: 'ACTIVE',
    });
    contextAggregator.aggregate.mockResolvedValue({
      systemPrompt:
        'system prompt\n\nInventory context:\n- Item: Cafe torrado 500g\n- Current price: BRL 14.90',
      diagnostics: {},
    });
    chatHistoryRepository.getHistory.mockResolvedValue([]);
    aiEngine.generateResponse.mockResolvedValue({
      text: 'Temos cafe torrado 500g por R$ 14,90 e ele esta disponivel.',
      tokensUsed: 30,
      confidence: 0.93,
      finishReason: 'stop',
      intent: 'QUESTION',
      sentiment: 'POSITIVE',
    });
    humanHandoffPolicy.evaluate.mockReturnValue({ shouldHandoff: false });
    responseProcessor.process.mockResolvedValue(
      'Temos cafe torrado 500g por R$ 14,90 e ele esta disponivel.',
    );

    const result = await useCase.execute({
      tenantId: tenant.id.toString(),
      conversationId: 'conversation-1',
      contactId: 'contact-1',
      content: { type: 'TEXT', text: 'Quanto esta o cafe 500g?' },
    });

    expect(result).toEqual({ success: true });
    expect(aiEngine.generateResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining('Inventory context:'),
      }),
    );
    expect(aiEngine.generateResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining('Current price: BRL 14.90'),
      }),
    );
  });

  it('should append commerce session context when there is an active conversational cart', async () => {
    const tenant = makeTenant();
    tenant.updateBusinessData({ businessType: 'MARKET' });
    tenantRepository.findById.mockResolvedValue(tenant);
    checkQuotaUseCase.execute.mockResolvedValue({
      canProceed: true,
      used: 10,
      quota: 1000,
      status: 'ACTIVE',
    });
    contextAggregator.aggregate.mockResolvedValue({
      systemPrompt:
        'system prompt\n\nCommerce flow context:\n- This business sells by conversational cart.\n\nShopping session context:\n- Session status: BUILDING_CART',
      diagnostics: {},
    });
    chatHistoryRepository.getHistory.mockResolvedValue([]);
    aiEngine.generateResponse.mockResolvedValue({
      text: 'Posso incluir mais itens no seu pedido antes de seguir para entrega.',
      tokensUsed: 36,
      confidence: 0.94,
      finishReason: 'stop',
      intent: 'QUESTION',
      sentiment: 'POSITIVE',
    });
    humanHandoffPolicy.evaluate.mockReturnValue({ shouldHandoff: false });
    responseProcessor.process.mockResolvedValue(
      'Posso incluir mais itens no seu pedido antes de seguir para entrega.',
    );

    const result = await useCase.execute({
      tenantId: tenant.id.toString(),
      conversationId: 'conversation-1',
      contactId: 'contact-1',
      content: { type: 'TEXT', text: 'quero adicionar mais um item' },
    });

    expect(result).toEqual({ success: true });
    expect(advanceCommerceConversationUseCase.execute).toHaveBeenCalledWith({
      tenantId: tenant.id.toString(),
      branchId: null,
      conversationId: 'conversation-1',
      contactId: 'contact-1',
      businessType: 'MARKET',
      userMessage: 'quero adicionar mais um item',
    });
    expect(aiEngine.generateResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining('Commerce flow context:'),
      }),
    );
    expect(aiEngine.generateResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining('Shopping session context:'),
      }),
    );
  });
});
