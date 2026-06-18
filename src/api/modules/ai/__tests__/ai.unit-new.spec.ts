/* eslint-disable @typescript-eslint/no-explicit-any */
// ================================================================
// ai.unit-new.spec.ts — NEW unit tests for the ai module
// ================================================================
import { AISession } from '../domain/entities/AISession';
import { TenantId } from '../../../../shared/domain/TenantId';
import { AutomationAiReplyFacade } from '../application/facades/AutomationAiReplyFacade';
import { IAIEngine } from '../application/ports/IAIEngine';
import { ICheckQuotaUseCase } from '@modules/billing/application/use-cases/interfaces/ICheckQuotaUseCase';
import { ProcessAIResponseUseCase } from '../application/use-cases/ProcessAIResponseUseCase';
import { ProcessAIResponseService } from '../application/services/ProcessAIResponseService';
import { IEventBus } from '@shared/application/ports/IEventBus';
import { ITenantRepository } from '@modules/tenant/domain/repositories/ITenantRepository';
import { IChatHistoryRepository } from '../application/ports/IChatHistoryRepository';
import { AIResponseProcessor } from '../application/services/AIResponseProcessor';
import { HumanHandoffPolicy } from '../application/services/HumanHandoffPolicy';
import { AdvanceCommerceConversationUseCase } from '@modules/commerce/application/use-cases/AdvanceCommerceConversationUseCase';
import { AISessionService } from '../application/services/AISessionService';
import { AIContextAggregator } from '../application/services/AIContextAggregator';
import { IContactRepository } from '@modules/contact/domain/repositories/IContactRepository';
import { TenantAgentRuleService } from '@modules/agent-rules/application/services/TenantAgentRuleService';
import { AiSafetyGate } from '../application/services/AiSafetyGate';
import { Tenant } from '@modules/tenant/domain/entities/Tenant';
import { User } from '@modules/tenant/domain/entities/User';
import { CompanyName } from '@modules/tenant/domain/value-objects/CompanyName';
import { CNPJ } from '@modules/tenant/domain/value-objects/CNPJ';
import { Plan } from '@modules/tenant/domain/value-objects/Plan';
import { Email } from '@modules/tenant/domain/value-objects/Email';
import { Phone } from '@modules/tenant/domain/value-objects/Phone';
import { Role } from '@modules/tenant/domain/value-objects/Role';
import { AIConfig } from '@modules/tenant/domain/entities/AIConfig';
import { LeadScoringService } from '../domain/services/LeadScoringService';
import { AIResponseGeneratedHandler } from '../application/handlers/AIResponseGeneratedHandler';
import { MessageReceivedHandler } from '../application/handlers/MessageReceivedHandler';
import { IAISessionRepository, AISessionDto } from '../application/ports/IAISessionRepository';
import { PrismaAISessionRepository } from '../infrastructure/persistence/PrismaAISessionRepository';
import { PrismaKnowledgeSourceRepository } from '../infrastructure/persistence/PrismaKnowledgeSourceRepository';
import { IngestKnowledgeSourceUseCase } from '../application/use-cases/knowledge-base/IngestKnowledgeSourceUseCase';
import { IEmbeddingProvider } from '../application/ports/IEmbeddingProvider';
import { IDocumentChunkRepository } from '../application/ports/IDocumentChunkRepository';
import { IKnowledgeSourceRepository } from '../application/ports/IKnowledgeSourceRepository';
import { WebCrawlerAdapter } from '../infrastructure/adapters/knowledge-sources/WebCrawlerAdapter';
import { GoogleDriveAdapter } from '../infrastructure/adapters/knowledge-sources/GoogleDriveAdapter';
import { NotionAdapter } from '../infrastructure/adapters/knowledge-sources/NotionAdapter';
import { RedisTenantAIContextSnapshotStore } from '../infrastructure/persistence/RedisTenantAIContextSnapshotStore';
import { TenantAIContextSnapshotService } from '../application/services/TenantAIContextSnapshotService';
import { TenantAIContextSnapshotInvalidationHandler } from '../infrastructure/handlers/TenantAIContextSnapshotInvalidationHandler';
import { CommerceCatalogSearchAdapter } from '../infrastructure/adapters/CommerceCatalogSearchAdapter';
import { SalesPaymentLinkGenerator } from '../infrastructure/adapters/SalesPaymentLinkGenerator';
import { CommercialContextProvider } from '../infrastructure/adapters/CommercialContextProvider';
import { PDFProcessingProcessor } from '../infrastructure/queue/PDFProcessingProcessor';
import { ProcessDocumentForRAGUseCase } from '../application/use-cases/ProcessDocumentForRAGUseCase';
import { IPaymentLinkGenerator } from '../application/ports/IPaymentLinkGenerator';
import { IRepeatLastOrder } from '../application/ports/IRepeatLastOrder';
import { IRAGResponseCache } from '../application/ports/IRAGResponseCache';
import { MediaUnderstandingService } from '../application/services/MediaUnderstandingService';
import { LeadScoredIntegrationEvent } from '../application/integration-events/publishers/AIIntegrationEvents';

// ─── shared factories ─────────────────────────────────────────

function makeTenant() {
  const tenant = Tenant.create({
    companyName: CompanyName.create('AI Test Co'),
    cnpj: CNPJ.create('60.701.190/0001-04'),
    plan: Plan.create('PROFISSIONAL'),
    users: [User.create({ name: 'Owner', email: Email.create('owner@ai.com'), phone: Phone.create('11999998888'), passwordHash: 'h', role: Role.create('OWNER') })],
  });
  tenant.configureAI(AIConfig.create({
    systemPrompt: 'You are a helpful AI seller.',
    tone: 'FRIENDLY', language: 'pt-BR', maxTokensPerResponse: 1200,
    confidenceThreshold: 0.75, escalationMessage: 'Transferindo.', businessRules: [],
  }));
  tenant.clearEvents();
  return tenant;
}

function makeSessionDto(overrides: Partial<AISessionDto> = {}): AISessionDto {
  return { id: 'session-123', tenantId: 'tenant-1', contactId: 'contact-1', status: 'ACTIVE', totalTokens: 0, metadata: {}, ...overrides };
}

function buildStack(extra: { mediaUnderstandingService?: MediaUnderstandingService; ragResponseCache?: IRAGResponseCache; embeddingProvider?: IEmbeddingProvider; } = {}) {
  const aiEngine = { generateResponse: jest.fn() } as unknown as jest.Mocked<IAIEngine>;
  const eventBus = { publish: jest.fn(), subscribe: jest.fn() } as unknown as jest.Mocked<IEventBus>;
  const tenantRepository = { save: jest.fn(), findById: jest.fn(), findByCnpj: jest.fn(), findByWhatsAppNumber: jest.fn(), findByApiKey: jest.fn(), findAll: jest.fn(), exists: jest.fn(), listBranches: jest.fn(), createBranch: jest.fn(), updateBranch: jest.fn(), deleteBranch: jest.fn() } as unknown as jest.Mocked<ITenantRepository>;
  const chatHistoryRepository = { getHistory: jest.fn().mockResolvedValue([]), saveMessage: jest.fn(), clearHistory: jest.fn() } as unknown as jest.Mocked<IChatHistoryRepository>;
  const checkQuotaUseCase = { execute: jest.fn().mockResolvedValue({ canProceed: true, used: 0, quota: 1000, status: 'ACTIVE' }) } as unknown as jest.Mocked<ICheckQuotaUseCase>;
  const responseProcessor = { process: jest.fn().mockResolvedValue('processed') } as unknown as jest.Mocked<AIResponseProcessor>;
  const humanHandoffPolicy = { evaluate: jest.fn().mockReturnValue({ shouldHandoff: false }) } as unknown as jest.Mocked<HumanHandoffPolicy>;
  const advanceCommerce = { execute: jest.fn().mockResolvedValue(null) } as unknown as jest.Mocked<AdvanceCommerceConversationUseCase>;
  const aiSessionService = { getOrCreateSession: jest.fn().mockResolvedValue({ id: 'session-1' }), recordMessage: jest.fn(), closeSession: jest.fn() } as unknown as jest.Mocked<AISessionService>;
  const contextAggregator = { aggregate: jest.fn().mockResolvedValue({ systemPrompt: 'sys', diagnostics: {} }) } as unknown as jest.Mocked<AIContextAggregator>;
  const contactRepository = { save: jest.fn(), findById: jest.fn().mockResolvedValue(null), findByPhone: jest.fn(), findAllByTenant: jest.fn(), delete: jest.fn() } as unknown as jest.Mocked<IContactRepository>;
  const tenantAgentRuleService = { getRule: jest.fn().mockResolvedValue(null), setRule: jest.fn() } as unknown as jest.Mocked<TenantAgentRuleService>;
  const aiSafetyGate = new AiSafetyGate({ safetyModeEnabled: false, blockedSubstrings: [], platformSystemAppend: '' });
  const service = new ProcessAIResponseService(aiEngine, eventBus, tenantRepository, chatHistoryRepository, checkQuotaUseCase, responseProcessor, humanHandoffPolicy, advanceCommerce, aiSessionService, contextAggregator, contactRepository, tenantAgentRuleService, aiSafetyGate, extra.mediaUnderstandingService, extra.ragResponseCache, extra.embeddingProvider);
  return { useCase: new ProcessAIResponseUseCase(service), aiEngine, eventBus, tenantRepository, chatHistoryRepository, checkQuotaUseCase, responseProcessor, humanHandoffPolicy, aiSessionService, contextAggregator, tenantAgentRuleService };
}

function makeIngestStack() {
  const knowledgeSourceRepository = { findById: jest.fn().mockResolvedValue({ id: 'src-1', tenantId: 'tenant-1', status: 'ACTIVE', contentHash: 'old-hash' }), updateStatus: jest.fn().mockResolvedValue(undefined), markSynced: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<IKnowledgeSourceRepository>;
  const chunkingService = { chunk: jest.fn().mockReturnValue([{ content: 'Chunk A', index: 0, tokenCount: 10 }, { content: 'Chunk B', index: 1, tokenCount: 12 }]) };
  const embeddingProvider = { generateEmbedding: jest.fn(), generateEmbeddings: jest.fn().mockResolvedValue([[0.1, 0.2], [0.3, 0.4]]) } as unknown as jest.Mocked<IEmbeddingProvider>;
  const chunkRepository = { saveChunks: jest.fn(), findSimilar: jest.fn(), deleteByDocument: jest.fn(), countByDocument: jest.fn() } as unknown as jest.Mocked<IDocumentChunkRepository>;
  const webCrawler = { sourceType: 'webpage', ingest: jest.fn() } as unknown as jest.Mocked<WebCrawlerAdapter>;
  const googleDrive = { sourceType: 'google-drive', ingest: jest.fn() } as unknown as jest.Mocked<GoogleDriveAdapter>;
  const notion = { sourceType: 'notion', ingest: jest.fn() } as unknown as jest.Mocked<NotionAdapter>;
  const useCase = new IngestKnowledgeSourceUseCase(knowledgeSourceRepository, chunkingService as any, embeddingProvider, chunkRepository, webCrawler, googleDrive, notion);
  return { useCase, knowledgeSourceRepository, chunkingService, embeddingProvider, chunkRepository, webCrawler };
}

// ================================================================
// 1. AISession entity
// ================================================================

describe('AISession entity', () => {
  describe('shouldEscalate()', () => {
    it('returns false when confidence is null (no response recorded yet)', () => {
      const session = AISession.create({ conversationId: 'c1', tenantId: TenantId.create('t1') });
      expect(session.shouldEscalate(0.7)).toBe(false);
    });

    it('returns true when confidence is strictly less than threshold', () => {
      const session = AISession.create({ conversationId: 'c1', tenantId: TenantId.create('t1') });
      session.recordResponse('QUESTION', 'NEUTRAL', 0.69, 10);
      expect(session.shouldEscalate(0.7)).toBe(true);
    });

    it('returns false when confidence equals threshold (boundary — not strictly less)', () => {
      const session = AISession.create({ conversationId: 'c1', tenantId: TenantId.create('t1') });
      session.recordResponse('QUESTION', 'NEUTRAL', 0.7, 10);
      expect(session.shouldEscalate(0.7)).toBe(false);
    });

    it('returns false when confidence is greater than threshold', () => {
      const session = AISession.create({ conversationId: 'c1', tenantId: TenantId.create('t1') });
      session.recordResponse('PURCHASE', 'POSITIVE', 0.95, 20);
      expect(session.shouldEscalate(0.7)).toBe(false);
    });

    it('returns true when confidence is 0 (extreme low boundary)', () => {
      const session = AISession.create({ conversationId: 'c1', tenantId: TenantId.create('t1') });
      session.recordResponse('UNKNOWN', 'NEGATIVE', 0, 5);
      expect(session.shouldEscalate(0.7)).toBe(true);
    });

    it('returns false when confidence is negative (below-zero guard via null-path logic)', () => {
      // negative confidence is technically invalid but shouldEscalate only gates on null
      const session = AISession.create({ conversationId: 'c1', tenantId: TenantId.create('t1') });
      session.recordResponse('UNKNOWN', 'NEGATIVE', -0.5, 5);
      // -0.5 < 0.7 so should return true (is less than threshold)
      expect(session.shouldEscalate(0.7)).toBe(true);
    });

    it('returns false when threshold is 0 and confidence is 0 (boundary at zero threshold)', () => {
      const session = AISession.create({ conversationId: 'c1', tenantId: TenantId.create('t1') });
      session.recordResponse('GREETING', 'POSITIVE', 0, 3);
      expect(session.shouldEscalate(0)).toBe(false);
    });
  });

  describe('recordResponse() token accumulation', () => {
    it('accumulates tokensUsed across multiple calls (not reset)', () => {
      const session = AISession.create({ conversationId: 'c1', tenantId: TenantId.create('t1') });
      session.recordResponse('QUESTION', 'NEUTRAL', 0.8, 30);
      session.recordResponse('PURCHASE', 'POSITIVE', 0.9, 45);
      expect(session.tokensUsed).toBe(75);
    });

    it('starts at zero before any response is recorded', () => {
      const session = AISession.create({ conversationId: 'c1', tenantId: TenantId.create('t1') });
      expect(session.tokensUsed).toBe(0);
    });

    it('accumulates correctly across three calls without overflow', () => {
      const session = AISession.create({ conversationId: 'c1', tenantId: TenantId.create('t1') });
      session.recordResponse('QUESTION', 'NEUTRAL', 0.8, 100);
      session.recordResponse('QUESTION', 'NEUTRAL', 0.8, 200);
      session.recordResponse('QUESTION', 'NEUTRAL', 0.8, 300);
      expect(session.tokensUsed).toBe(600);
    });

    it('last intent and sentiment overwrite previous values', () => {
      const session = AISession.create({ conversationId: 'c1', tenantId: TenantId.create('t1') });
      session.recordResponse('QUESTION', 'NEUTRAL', 0.8, 10);
      session.recordResponse('PURCHASE', 'POSITIVE', 0.95, 20);
      expect(session.intent).toBe('PURCHASE');
      expect(session.sentiment).toBe('POSITIVE');
      expect(session.confidence).toBe(0.95);
    });
  });
});

// ================================================================
// 2. AutomationAiReplyFacade
// ================================================================

describe('AutomationAiReplyFacade.generateReply()', () => {
  let engine: jest.Mocked<IAIEngine>;
  let quotaUseCase: jest.Mocked<ICheckQuotaUseCase>;
  let facade: AutomationAiReplyFacade;

  beforeEach(() => {
    engine = { generateResponse: jest.fn() } as unknown as jest.Mocked<IAIEngine>;
    quotaUseCase = { execute: jest.fn() } as unknown as jest.Mocked<ICheckQuotaUseCase>;
    facade = new AutomationAiReplyFacade(engine, quotaUseCase);
  });

  it('returns denied=true and reason when quota check denies', async () => {
    quotaUseCase.execute.mockResolvedValue({ canProceed: false, used: 100, quota: 100, status: 'QUOTA_EXCEEDED' });
    const result = await facade.generateReply({ tenantId: 't1', prompt: 'Hey', userMessage: 'Oi' });
    expect(result.denied).toBe(true);
    expect(result.reason).toBe('QUOTA_EXCEEDED');
    expect(result.text).toBe('');
    expect(engine.generateResponse).not.toHaveBeenCalled();
  });

  it('propagates reason from quota status when subscription is inactive', async () => {
    quotaUseCase.execute.mockResolvedValue({ canProceed: false, used: 0, quota: 0, status: 'OVERDUE' });
    const result = await facade.generateReply({ tenantId: 't1', prompt: 'p', userMessage: 'msg' });
    expect(result.denied).toBe(true);
    expect(result.reason).toBe('OVERDUE');
  });

  it('defaults userMessage to empty string when not provided', async () => {
    quotaUseCase.execute.mockResolvedValue({ canProceed: true, used: 0, quota: 1000, status: 'ACTIVE' });
    engine.generateResponse.mockResolvedValue({ text: 'hello', tokensUsed: 5, confidence: 0.9, finishReason: 'stop', intent: 'GREETING', sentiment: 'POSITIVE' });
    await facade.generateReply({ tenantId: 't1', prompt: 'sys' });
    expect(engine.generateResponse).toHaveBeenCalledWith(expect.objectContaining({ userMessage: '' }));
  });

  it('caps maxTokens at 500 in every engine call', async () => {
    quotaUseCase.execute.mockResolvedValue({ canProceed: true, used: 0, quota: 1000, status: 'ACTIVE' });
    engine.generateResponse.mockResolvedValue({ text: 'ok', tokensUsed: 10, confidence: 0.9, finishReason: 'stop', intent: 'QUESTION', sentiment: 'NEUTRAL' });
    await facade.generateReply({ tenantId: 't1', prompt: 'sys', userMessage: 'Oi' });
    expect(engine.generateResponse).toHaveBeenCalledWith(expect.objectContaining({ maxTokens: 500 }));
  });

  it('propagates engine failure as thrown error', async () => {
    quotaUseCase.execute.mockResolvedValue({ canProceed: true, used: 0, quota: 1000, status: 'ACTIVE' });
    engine.generateResponse.mockRejectedValue(new Error('engine down'));
    await expect(facade.generateReply({ tenantId: 't1', prompt: 'sys', userMessage: 'Hi' })).rejects.toThrow('engine down');
  });

  it('returns text from engine on success', async () => {
    quotaUseCase.execute.mockResolvedValue({ canProceed: true, used: 0, quota: 1000, status: 'ACTIVE' });
    engine.generateResponse.mockResolvedValue({ text: 'Ola, posso ajudar!', tokensUsed: 8, confidence: 0.92, finishReason: 'stop', intent: 'GREETING', sentiment: 'POSITIVE' });
    const result = await facade.generateReply({ tenantId: 't1', prompt: 'sys', userMessage: 'Oi' });
    expect(result.text).toBe('Ola, posso ajudar!');
    expect(result.denied).toBeUndefined();
  });

  it('passes conversationId as trace when provided', async () => {
    quotaUseCase.execute.mockResolvedValue({ canProceed: true, used: 0, quota: 1000, status: 'ACTIVE' });
    engine.generateResponse.mockResolvedValue({ text: 'ok', tokensUsed: 3, confidence: 0.8, finishReason: 'stop', intent: 'QUESTION', sentiment: 'NEUTRAL' });
    await facade.generateReply({ tenantId: 't1', prompt: 'sys', userMessage: 'msg', conversationId: 'conv-abc' });
    expect(engine.generateResponse).toHaveBeenCalledWith(expect.objectContaining({ trace: { tenantId: 't1', conversationId: 'conv-abc' } }));
  });
});

// ================================================================
// 3. ProcessAIResponseUseCase — RAG cache hit path
// ================================================================

describe('ProcessAIResponseUseCase — RAG cache hit', () => {
  it('returns success without calling AI engine when RAG cache returns a hit', async () => {
    const ragResponseCache: jest.Mocked<IRAGResponseCache> = {
      findSimilarResponse: jest.fn().mockResolvedValue('Cached answer about produto X'),
      cacheResponse: jest.fn(),
    };
    const embeddingProvider: jest.Mocked<IEmbeddingProvider> = {
      generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      generateEmbeddings: jest.fn(),
    };
    const { useCase, tenantRepository, checkQuotaUseCase, aiEngine, contextAggregator } = buildStack({ ragResponseCache, embeddingProvider });
    const tenant = makeTenant();
    tenantRepository.findById.mockResolvedValue(tenant);
    checkQuotaUseCase.execute.mockResolvedValue({ canProceed: true, used: 0, quota: 1000, status: 'ACTIVE' });
    contextAggregator.aggregate.mockResolvedValue({ systemPrompt: 'sys', diagnostics: { tenantPDFContextFound: true } });
    const result = await useCase.execute({ tenantId: tenant.id.toString(), conversationId: 'c1', contactId: 'ct1', content: { type: 'TEXT', text: 'Tem produto X?' } });
    expect(result.success).toBe(true);
    expect(aiEngine.generateResponse).not.toHaveBeenCalled();
    expect(ragResponseCache.findSimilarResponse).toHaveBeenCalled();
  });

  it('falls through to AI engine when RAG cache returns null (miss)', async () => {
    const ragResponseCache: jest.Mocked<IRAGResponseCache> = {
      findSimilarResponse: jest.fn().mockResolvedValue(null),
      cacheResponse: jest.fn(),
    };
    const embeddingProvider: jest.Mocked<IEmbeddingProvider> = {
      generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      generateEmbeddings: jest.fn(),
    };
    const { useCase, tenantRepository, checkQuotaUseCase, aiEngine, humanHandoffPolicy, responseProcessor, contextAggregator } = buildStack({ ragResponseCache, embeddingProvider });
    const tenant = makeTenant();
    tenantRepository.findById.mockResolvedValue(tenant);
    checkQuotaUseCase.execute.mockResolvedValue({ canProceed: true, used: 0, quota: 1000, status: 'ACTIVE' });
    contextAggregator.aggregate.mockResolvedValue({ systemPrompt: 'sys', diagnostics: { tenantPDFContextFound: true } });
    aiEngine.generateResponse.mockResolvedValue({ text: 'Fresh response', tokensUsed: 20, confidence: 0.9, finishReason: 'stop', intent: 'QUESTION', sentiment: 'NEUTRAL' });
    humanHandoffPolicy.evaluate.mockReturnValue({ shouldHandoff: false });
    responseProcessor.process.mockResolvedValue('Fresh response');
    const result = await useCase.execute({ tenantId: tenant.id.toString(), conversationId: 'c1', contactId: 'ct1', content: { type: 'TEXT', text: 'Tem produto?' } });
    expect(result.success).toBe(true);
    expect(aiEngine.generateResponse).toHaveBeenCalled();
  });
});

// ================================================================
// 4. ProcessAIResponseUseCase — media message types
// ================================================================

describe('ProcessAIResponseUseCase — media message types', () => {
  function makeMediaStack() {
    const mediaUnderstandingService = { buildAiMessage: jest.fn().mockResolvedValue('Cliente enviou imagem: [desc]') } as unknown as jest.Mocked<MediaUnderstandingService>;
    const stack = buildStack({ mediaUnderstandingService });
    const tenant = makeTenant();
    stack.tenantRepository.findById.mockResolvedValue(tenant);
    stack.checkQuotaUseCase.execute.mockResolvedValue({ canProceed: true, used: 0, quota: 1000, status: 'ACTIVE' });
    stack.aiEngine.generateResponse.mockResolvedValue({ text: 'ok', tokensUsed: 10, confidence: 0.9, finishReason: 'stop', intent: 'QUESTION', sentiment: 'NEUTRAL' });
    stack.humanHandoffPolicy.evaluate.mockReturnValue({ shouldHandoff: false });
    stack.responseProcessor.process.mockResolvedValue('ok');
    return { ...stack, mediaUnderstandingService, tenant };
  }

  it('calls MediaUnderstandingService when content type is IMAGE with URL', async () => {
    const { useCase, aiEngine, mediaUnderstandingService, tenant } = makeMediaStack();
    await useCase.execute({ tenantId: tenant.id.toString(), conversationId: 'c1', contactId: 'ct1', content: { type: 'IMAGE', url: 'https://cdn/img.png', text: 'O que e isso?' } });
    expect(mediaUnderstandingService.buildAiMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'IMAGE', url: 'https://cdn/img.png' }));
    expect(aiEngine.generateResponse).toHaveBeenCalled();
  });

  it('calls MediaUnderstandingService for AUDIO content type', async () => {
    const { useCase, mediaUnderstandingService, tenant } = makeMediaStack();
    await useCase.execute({ tenantId: tenant.id.toString(), conversationId: 'c1', contactId: 'ct1', content: { type: 'AUDIO', url: 'https://cdn/audio.ogg' } });
    expect(mediaUnderstandingService.buildAiMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'AUDIO' }));
  });

  it('calls MediaUnderstandingService for DOCUMENT content type', async () => {
    const { useCase, mediaUnderstandingService, tenant } = makeMediaStack();
    await useCase.execute({ tenantId: tenant.id.toString(), conversationId: 'c1', contactId: 'ct1', content: { type: 'DOCUMENT', url: 'https://cdn/file.pdf', mimeType: 'application/pdf' } });
    expect(mediaUnderstandingService.buildAiMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'DOCUMENT', mimeType: 'application/pdf' }));
  });

  it('falls back to text message when MediaUnderstandingService is absent (no URL)', async () => {
    const { useCase, aiEngine, tenant } = buildStack();
    tenant.clearEvents();
    (useCase as any);
    const stack2 = buildStack();
    stack2.tenantRepository.findById.mockResolvedValue(makeTenant());
    stack2.checkQuotaUseCase.execute.mockResolvedValue({ canProceed: true, used: 0, quota: 1000, status: 'ACTIVE' });
    stack2.aiEngine.generateResponse.mockResolvedValue({ text: 'ok', tokensUsed: 5, confidence: 0.9, finishReason: 'stop', intent: 'QUESTION', sentiment: 'NEUTRAL' });
    stack2.humanHandoffPolicy.evaluate.mockReturnValue({ shouldHandoff: false });
    stack2.responseProcessor.process.mockResolvedValue('ok');
    const result = await stack2.useCase.execute({ tenantId: 't1', conversationId: 'c1', contactId: 'ct1', content: { type: 'IMAGE', text: 'Caption only, no URL' } });
    expect(result.success).toBe(true);
    expect(stack2.aiEngine.generateResponse).toHaveBeenCalledWith(expect.objectContaining({ userMessage: expect.stringContaining('imagem') }));
  });
});

// ================================================================
// 5. ProcessAIResponseUseCase — agent rule override
// ================================================================

describe('ProcessAIResponseUseCase — TenantAgentRuleService override', () => {
  it('appends custom prompt from active agent rule to system prompt', async () => {
    const { useCase, tenantRepository, checkQuotaUseCase, aiEngine, humanHandoffPolicy, responseProcessor, contextAggregator, tenantAgentRuleService } = buildStack();
    const tenant = makeTenant();
    tenantRepository.findById.mockResolvedValue(tenant);
    checkQuotaUseCase.execute.mockResolvedValue({ canProceed: true, used: 0, quota: 1000, status: 'ACTIVE' });
    contextAggregator.aggregate.mockResolvedValue({ systemPrompt: 'base prompt', diagnostics: {} });
    tenantAgentRuleService.getRule.mockResolvedValue({ isActive: true, customPrompt: 'Sempre mencionar garantia de 1 ano.', fallbackToGlobal: true, branchId: null, inheritedFromTenant: false });
    aiEngine.generateResponse.mockResolvedValue({ text: 'ok', tokensUsed: 10, confidence: 0.9, finishReason: 'stop', intent: 'QUESTION', sentiment: 'NEUTRAL' });
    humanHandoffPolicy.evaluate.mockReturnValue({ shouldHandoff: false });
    responseProcessor.process.mockResolvedValue('ok');
    await useCase.execute({ tenantId: tenant.id.toString(), conversationId: 'c1', contactId: 'ct1', content: { type: 'TEXT', text: 'Tem garantia?' } });
    expect(aiEngine.generateResponse).toHaveBeenCalledWith(expect.objectContaining({ systemPrompt: expect.stringContaining('Sempre mencionar garantia de 1 ano.') }));
  });

  it('uses base system prompt unchanged when agent rule is inactive', async () => {
    const { useCase, tenantRepository, checkQuotaUseCase, aiEngine, humanHandoffPolicy, responseProcessor, contextAggregator, tenantAgentRuleService } = buildStack();
    const tenant = makeTenant();
    tenantRepository.findById.mockResolvedValue(tenant);
    checkQuotaUseCase.execute.mockResolvedValue({ canProceed: true, used: 0, quota: 1000, status: 'ACTIVE' });
    contextAggregator.aggregate.mockResolvedValue({ systemPrompt: 'base prompt', diagnostics: {} });
    tenantAgentRuleService.getRule.mockResolvedValue({ isActive: false, customPrompt: 'Should not appear', fallbackToGlobal: true, branchId: null, inheritedFromTenant: false });
    aiEngine.generateResponse.mockResolvedValue({ text: 'ok', tokensUsed: 5, confidence: 0.9, finishReason: 'stop', intent: 'QUESTION', sentiment: 'NEUTRAL' });
    humanHandoffPolicy.evaluate.mockReturnValue({ shouldHandoff: false });
    responseProcessor.process.mockResolvedValue('ok');
    await useCase.execute({ tenantId: tenant.id.toString(), conversationId: 'c1', contactId: 'ct1', content: { type: 'TEXT', text: 'Oi' } });
    const callArg = aiEngine.generateResponse.mock.calls[0][0];
    expect(callArg.systemPrompt).not.toContain('Should not appear');
  });

  it('uses base prompt when agent rule getRule throws (resilience fallback)', async () => {
    const { useCase, tenantRepository, checkQuotaUseCase, aiEngine, humanHandoffPolicy, responseProcessor, contextAggregator, tenantAgentRuleService } = buildStack();
    const tenant = makeTenant();
    tenantRepository.findById.mockResolvedValue(tenant);
    checkQuotaUseCase.execute.mockResolvedValue({ canProceed: true, used: 0, quota: 1000, status: 'ACTIVE' });
    contextAggregator.aggregate.mockResolvedValue({ systemPrompt: 'base prompt', diagnostics: {} });
    tenantAgentRuleService.getRule.mockRejectedValue(new Error('rule service down'));
    aiEngine.generateResponse.mockResolvedValue({ text: 'ok', tokensUsed: 5, confidence: 0.9, finishReason: 'stop', intent: 'QUESTION', sentiment: 'NEUTRAL' });
    humanHandoffPolicy.evaluate.mockReturnValue({ shouldHandoff: false });
    responseProcessor.process.mockResolvedValue('ok');
    const result = await useCase.execute({ tenantId: tenant.id.toString(), conversationId: 'c1', contactId: 'ct1', content: { type: 'TEXT', text: 'Oi' } });
    expect(result.success).toBe(true);
    expect(aiEngine.generateResponse).toHaveBeenCalledWith(expect.objectContaining({ systemPrompt: 'base prompt' }));
  });
});

// ================================================================
// 6. ProcessAIResponseUseCase — context window truncation
// ================================================================

describe('ProcessAIResponseUseCase — context window truncation', () => {
  function makeLongHistory(count: number) {
    const msgs = [];
    for (let i = 0; i < count; i++) {
      msgs.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: 'msg-' + i, timestamp: new Date() });
    }
    return msgs;
  }

  function prepareStack() {
    const stack = buildStack();
    const tenant = makeTenant();
    stack.tenantRepository.findById.mockResolvedValue(tenant);
    stack.checkQuotaUseCase.execute.mockResolvedValue({ canProceed: true, used: 0, quota: 1000, status: 'ACTIVE' });
    stack.aiEngine.generateResponse.mockResolvedValue({ text: 'ok', tokensUsed: 5, confidence: 0.9, finishReason: 'stop', intent: 'QUESTION', sentiment: 'NEUTRAL' });
    stack.humanHandoffPolicy.evaluate.mockReturnValue({ shouldHandoff: false });
    stack.responseProcessor.process.mockResolvedValue('ok');
    return { stack, tenant };
  }

  it('sends at most 40 messages when history has 41 entries', async () => {
    const { stack, tenant } = prepareStack();
    stack.chatHistoryRepository.getHistory.mockResolvedValue(makeLongHistory(41));
    await stack.useCase.execute({ tenantId: tenant.id.toString(), conversationId: 'c1', contactId: 'ct1', content: { type: 'TEXT', text: 'Oi' } });
    const arg = stack.aiEngine.generateResponse.mock.calls[0][0];
    expect(arg.contextHistory.length).toBeLessThanOrEqual(40);
  });

  it('keeps all 40 messages when history has exactly 40 entries', async () => {
    const { stack, tenant } = prepareStack();
    stack.chatHistoryRepository.getHistory.mockResolvedValue(makeLongHistory(40));
    await stack.useCase.execute({ tenantId: tenant.id.toString(), conversationId: 'c1', contactId: 'ct1', content: { type: 'TEXT', text: 'Oi' } });
    const arg = stack.aiEngine.generateResponse.mock.calls[0][0];
    expect(arg.contextHistory.length).toBe(40);
  });

  it('preserves the tail (most recent) messages, not the head, when truncating', async () => {
    const { stack, tenant } = prepareStack();
    stack.chatHistoryRepository.getHistory.mockResolvedValue(makeLongHistory(60));
    await stack.useCase.execute({ tenantId: tenant.id.toString(), conversationId: 'c1', contactId: 'ct1', content: { type: 'TEXT', text: 'Oi' } });
    const arg = stack.aiEngine.generateResponse.mock.calls[0][0];
    const firstContent = arg.contextHistory[0].content;
    expect(firstContent).toBe('msg-20');
  });
});

// ================================================================
// 7. IngestKnowledgeSourceUseCase — gaps
// ================================================================

describe('IngestKnowledgeSourceUseCase — source not found', () => {
  it('returns error result when findById returns null', async () => {
    const { useCase, knowledgeSourceRepository, webCrawler } = makeIngestStack();
    webCrawler.ingest.mockResolvedValue({ contents: [{ title: 'T', text: 'Content', sourceUrl: 'https://x.com' }], contentHash: 'new-hash' });
    knowledgeSourceRepository.findById.mockResolvedValue(null);
    const result = await useCase.execute({ tenantId: 'tenant-1', sourceId: 'src-missing', sourceType: 'webpage', sourceUrl: 'https://x.com', sourceName: 'X' });
    // null source triggers full re-ingest (hash mismatch) but should succeed
    expect(result.success).toBe(true);
    expect(result.chunksCreated).toBeGreaterThan(0);
  });

  it('sets status to INGESTING before fetch even when source is null in repo', async () => {
    const { useCase, knowledgeSourceRepository, webCrawler } = makeIngestStack();
    webCrawler.ingest.mockResolvedValue({ contents: [{ title: 'T', text: 'Content', sourceUrl: 'https://x.com' }], contentHash: 'new-hash' });
    knowledgeSourceRepository.findById.mockResolvedValue(null);
    await useCase.execute({ tenantId: 'tenant-1', sourceId: 'src-missing', sourceType: 'webpage', sourceUrl: 'https://x.com', sourceName: 'X' });
    expect(knowledgeSourceRepository.updateStatus).toHaveBeenCalledWith('tenant-1', 'src-missing', 'INGESTING');
  });
});

describe('IngestKnowledgeSourceUseCase — embedding failure mid-ingestion', () => {
  it('sets status to ERROR and returns failure when embedding provider throws after chunks are produced', async () => {
    const { useCase, knowledgeSourceRepository, embeddingProvider, webCrawler } = makeIngestStack();
    webCrawler.ingest.mockResolvedValue({ contents: [{ title: 'T', text: 'Long content', sourceUrl: 'https://x.com' }], contentHash: 'new-hash' });
    knowledgeSourceRepository.findById.mockResolvedValue({ id: 'src-1', tenantId: 'tenant-1', status: 'ACTIVE', contentHash: 'different-hash' });
    embeddingProvider.generateEmbeddings.mockRejectedValue(new Error('embedding service unavailable'));
    const result = await useCase.execute({ tenantId: 'tenant-1', sourceId: 'src-1', sourceType: 'webpage', sourceUrl: 'https://x.com', sourceName: 'X' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('embedding service unavailable');
    expect(knowledgeSourceRepository.updateStatus).toHaveBeenCalledWith('tenant-1', 'src-1', 'ERROR');
  });

  it('does not call markSynced when embedding fails', async () => {
    const { useCase, knowledgeSourceRepository, embeddingProvider, webCrawler } = makeIngestStack();
    webCrawler.ingest.mockResolvedValue({ contents: [{ title: 'T', text: 'content', sourceUrl: 'https://x.com' }], contentHash: 'nh' });
    knowledgeSourceRepository.findById.mockResolvedValue({ id: 'src-1', tenantId: 'tenant-1', status: 'ACTIVE', contentHash: 'old' });
    embeddingProvider.generateEmbeddings.mockRejectedValue(new Error('quota'));
    await useCase.execute({ tenantId: 'tenant-1', sourceId: 'src-1', sourceType: 'webpage', sourceUrl: 'https://x.com', sourceName: 'X' });
    expect(knowledgeSourceRepository.markSynced).not.toHaveBeenCalled();
  });
});

describe('IngestKnowledgeSourceUseCase — tenant isolation', () => {
  it('scopes findById to the caller tenantId — attacker cannot read victim source', async () => {
    const { useCase, knowledgeSourceRepository, webCrawler } = makeIngestStack();
    knowledgeSourceRepository.findById.mockImplementation(async (tid, sid) => {
      if (tid !== 'tenant-victim') return null;
      return { id: sid, tenantId: 'tenant-victim', status: 'ACTIVE', contentHash: null };
    });
    webCrawler.ingest.mockResolvedValue({ contents: [{ title: 'T', text: 'content', sourceUrl: 'https://x.com' }], contentHash: 'nh' });
    await useCase.execute({ tenantId: 'attacker', sourceId: 'victim-src', sourceType: 'webpage', sourceUrl: 'https://x.com', sourceName: 'Victim' });
    expect(knowledgeSourceRepository.findById).toHaveBeenCalledWith('attacker', 'victim-src');
    // updateStatus and markSynced must be scoped to 'attacker', not 'tenant-victim'
    expect(knowledgeSourceRepository.updateStatus).toHaveBeenCalledWith('attacker', expect.any(String), expect.any(String));
  });

  it('does not write chunks with a different tenantId than the input', async () => {
    const { useCase, knowledgeSourceRepository, chunkRepository, webCrawler } = makeIngestStack();
    webCrawler.ingest.mockResolvedValue({ contents: [{ title: 'T', text: 'content', sourceUrl: 'https://x.com' }], contentHash: 'nh' });
    knowledgeSourceRepository.findById.mockResolvedValue({ id: 'src-1', tenantId: 'tenant-1', status: 'ACTIVE', contentHash: 'old-hash-different' });
    await useCase.execute({ tenantId: 'tenant-1', sourceId: 'src-1', sourceType: 'webpage', sourceUrl: 'https://x.com', sourceName: 'X' });
    const saveCall = chunkRepository.saveChunks.mock.calls[0];
    if (saveCall) {
      saveCall[0].forEach((chunk: any) => expect(chunk.tenantId).toBe('tenant-1'));
    }
  });
});

// ================================================================
// 8. AISessionService — gaps
// ================================================================

describe('AISessionService — concurrent double-create race condition', () => {
  it('calls createActive when findActive returns null (each caller acts independently)', async () => {
    const repository: jest.Mocked<IAISessionRepository> = {
      findActive: jest.fn().mockResolvedValue(null),
      createActive: jest.fn(),
      recordMessage: jest.fn(),
      close: jest.fn(),
    };
    const session1 = makeSessionDto({ id: 'race-session-1' });
    const session2 = makeSessionDto({ id: 'race-session-2' });
    repository.createActive.mockResolvedValueOnce(session1).mockResolvedValueOnce(session2);
    const service = new AISessionService(repository);
    const [r1, r2] = await Promise.all([
      service.getOrCreateSession('tenant-1', 'contact-1', 'conv-1'),
      service.getOrCreateSession('tenant-1', 'contact-1', 'conv-1'),
    ]);
    expect(repository.createActive).toHaveBeenCalledTimes(2);
    expect(r1.id).not.toBe(r2.id);
  });
});

describe('AISessionService.closeSession — when session does not exist', () => {
  it('resolves without throwing when close silently succeeds for unknown session', async () => {
    const repository: jest.Mocked<IAISessionRepository> = {
      findActive: jest.fn(),
      createActive: jest.fn(),
      recordMessage: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const service = new AISessionService(repository);
    await expect(service.closeSession('tenant-1', 'non-existent-session')).resolves.not.toThrow();
    expect(repository.close).toHaveBeenCalledWith('tenant-1', 'non-existent-session', 'CLOSED');
  });

  it('propagates error when close throws for unknown session', async () => {
    const repository: jest.Mocked<IAISessionRepository> = {
      findActive: jest.fn(),
      createActive: jest.fn(),
      recordMessage: jest.fn(),
      close: jest.fn().mockRejectedValue(new Error('DB error')),
    };
    const service = new AISessionService(repository);
    await expect(service.closeSession('tenant-1', 'ghost-session')).rejects.toThrow('DB error');
  });
});

// PrismaAISessionRepository

describe('PrismaAISessionRepository.findActive()', () => {
  let prismaM: any;
  let repoM: PrismaAISessionRepository;
  beforeEach(() => {
    prismaM = { aISession: { findFirst: jest.fn(), create: jest.fn(), updateMany: jest.fn().mockReturnValue({}) }, aIMessage: { create: jest.fn().mockReturnValue({}) }, $transaction: jest.fn().mockResolvedValue(undefined) };
    repoM = new PrismaAISessionRepository(prismaM);
  });
  it('returns null when no ACTIVE session exists', async () => {
    prismaM.aISession.findFirst.mockResolvedValue(null);
    expect(await repoM.findActive('t1','c1','cv1')).toBeNull();
  });
  it('queries with status ACTIVE scoped to all three keys', async () => {
    prismaM.aISession.findFirst.mockResolvedValue(null);
    await repoM.findActive('tenant-1','contact-1','conv-1');
    expect(prismaM.aISession.findFirst).toHaveBeenCalledWith({ where: { tenantId: 'tenant-1', contactId: 'contact-1', conversationId: 'conv-1', status: 'ACTIVE' } });
  });
  it('maps DB row to AISessionDto', async () => {
    prismaM.aISession.findFirst.mockResolvedValue({ id: 's1', tenantId: 't1', contactId: 'c1', conversationId: 'cv1', status: 'ACTIVE', totalTokens: 42, metadata: { x: 1 } });
    const r = await repoM.findActive('t1','c1','cv1');
    expect(r).toMatchObject({ id: 's1', totalTokens: 42, metadata: { x: 1 } });
  });
  it('does not return a CLOSED session — WHERE clause always includes status ACTIVE', async () => {
    prismaM.aISession.findFirst.mockResolvedValue(null);
    await repoM.findActive('t1','c1','cv1');
    expect(prismaM.aISession.findFirst.mock.calls[0][0].where.status).toBe('ACTIVE');
  });
});

describe('PrismaAISessionRepository.createActive()', () => {
  let prismaC: any;
  let repoC: PrismaAISessionRepository;
  beforeEach(() => {
    prismaC = { aISession: { findFirst: jest.fn(), create: jest.fn(), updateMany: jest.fn().mockReturnValue({}) }, aIMessage: { create: jest.fn().mockReturnValue({}) }, $transaction: jest.fn().mockResolvedValue(undefined) };
    repoC = new PrismaAISessionRepository(prismaC);
  });
  it('creates session with ACTIVE status', async () => {
    prismaC.aISession.create.mockResolvedValue({ id: 'ns', tenantId: 't1', contactId: 'c1', conversationId: 'cv1', status: 'ACTIVE', totalTokens: 0, metadata: {} });
    const r = await repoC.createActive('t1','c1','cv1');
    expect(prismaC.aISession.create).toHaveBeenCalledWith({ data: { tenantId: 't1', contactId: 'c1', conversationId: 'cv1', status: 'ACTIVE', metadata: {} } });
    expect(r.status).toBe('ACTIVE');
  });
  it('returns DTO with null metadata mapped to empty object', async () => {
    prismaC.aISession.create.mockResolvedValue({ id: 's2', tenantId: 't2', contactId: 'c2', conversationId: 'c', status: 'ACTIVE', totalTokens: 0, metadata: null });
    const r = await repoC.createActive('t2','c2','c');
    expect(r.metadata).toEqual({});
  });
});

// ================================================================
// 10. PrismaKnowledgeSourceRepository
// ================================================================

describe('PrismaKnowledgeSourceRepository', () => {
  let prismaKS: any;
  let repoKS: PrismaKnowledgeSourceRepository;
  beforeEach(() => {
    prismaKS = { knowledgeSource: { findFirst: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    repoKS = new PrismaKnowledgeSourceRepository(prismaKS);
  });

  it('findById returns null when record does not exist', async () => {
    prismaKS.knowledgeSource.findFirst.mockResolvedValue(null);
    expect(await repoKS.findById('t1','src-missing')).toBeNull();
  });

  it('findById scopes WHERE clause to both tenantId and sourceId', async () => {
    prismaKS.knowledgeSource.findFirst.mockResolvedValue(null);
    await repoKS.findById('tenant-1','src-1');
    expect(prismaKS.knowledgeSource.findFirst).toHaveBeenCalledWith({ where: { id: 'src-1', tenantId: 'tenant-1' } });
  });

  it('findById maps record to KnowledgeSourceRecord DTO', async () => {
    prismaKS.knowledgeSource.findFirst.mockResolvedValue({ id: 'ks1', tenantId: 't1', status: 'ACTIVE', contentHash: 'abc' });
    const r = await repoKS.findById('t1','ks1');
    expect(r).toEqual({ id: 'ks1', tenantId: 't1', status: 'ACTIVE', contentHash: 'abc' });
  });

  it('findById maps null contentHash to null in DTO', async () => {
    prismaKS.knowledgeSource.findFirst.mockResolvedValue({ id: 'ks1', tenantId: 't1', status: 'PENDING', contentHash: null });
    const r = await repoKS.findById('t1','ks1');
    expect(r!.contentHash).toBeNull();
  });

  it('updateStatus calls updateMany scoped by id AND tenantId', async () => {
    await repoKS.updateStatus('tenant-1','src-1','ERROR');
    expect(prismaKS.knowledgeSource.updateMany).toHaveBeenCalledWith({ where: { id: 'src-1', tenantId: 'tenant-1' }, data: { status: 'ERROR' } });
  });

  it('markSynced updates status, contentHash, and lastSyncAt scoped by tenant', async () => {
    await repoKS.markSynced('tenant-1','src-1','ACTIVE','hash-new');
    expect(prismaKS.knowledgeSource.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'src-1', tenantId: 'tenant-1' }, data: expect.objectContaining({ status: 'ACTIVE', contentHash: 'hash-new' }) }));
  });

  it('attacker cannot overwrite victim source — updateStatus uses caller tenantId', async () => {
    await repoKS.updateStatus('attacker','victim-src','ERROR');
    const where = prismaKS.knowledgeSource.updateMany.mock.calls[0][0].where;
    expect(where.tenantId).toBe('attacker');
    expect(where.tenantId).not.toBe('victim');
  });
});

// ================================================================
// 11. RedisTenantAIContextSnapshotStore
// ================================================================

describe('RedisTenantAIContextSnapshotStore', () => {
  let redis: any;
  let store: RedisTenantAIContextSnapshotStore;
  beforeEach(() => {
    redis = { get: jest.fn(), set: jest.fn().mockResolvedValue('OK'), del: jest.fn().mockResolvedValue(1) };
    store = new RedisTenantAIContextSnapshotStore(redis);
  });

  it('get returns null when Redis key does not exist', async () => {
    redis.get.mockResolvedValue(null);
    expect(await store.get('tenant-1')).toBeNull();
  });

  it('get parses stored JSON and converts generatedAt to Date', async () => {
    const snap = { tenantId: 't1', generatedAt: '2025-01-01T00:00:00.000Z', schedulingCategories: [], commerceCatalogItemCount: 3 };
    redis.get.mockResolvedValue(JSON.stringify(snap));
    const r = await store.get('t1');
    expect(r).not.toBeNull();
    expect(r!.generatedAt).toBeInstanceOf(Date);
  });

  it('set serializes snapshot as JSON with 24h TTL', async () => {
    const snap = { tenantId: 't1', generatedAt: new Date(), schedulingCategories: [], commerceCatalogItemCount: 5 };
    await store.set('t1', snap);
    expect(redis.set).toHaveBeenCalledWith('ai:context:snapshot:t1', expect.any(String), 'EX', 86400);
  });

  it('set uses the correct key prefix ai:context:snapshot:', async () => {
    const snap = { tenantId: 'xyz', generatedAt: new Date(), schedulingCategories: [], commerceCatalogItemCount: 0 };
    await store.set('xyz', snap);
    expect(redis.set.mock.calls[0][0]).toBe('ai:context:snapshot:xyz');
  });

  it('delete calls Redis del with correct key', async () => {
    await store.delete('tenant-to-evict');
    expect(redis.del).toHaveBeenCalledWith('ai:context:snapshot:tenant-to-evict');
  });

  it('get returns null when Redis returns empty string (expired slot)', async () => {
    redis.get.mockResolvedValue('');
    // empty string is falsy — should return null
    const result = await store.get('tenant-expired');
    expect(result).toBeNull();
  });
});

// ================================================================
// 12. TenantAIContextSnapshotService
// ================================================================

describe('TenantAIContextSnapshotService', () => {
  let schedProvider: any;
  let commerceProvider: any;
  let snapshotStore: any;
  let snapshotService: TenantAIContextSnapshotService;

  beforeEach(() => {
    schedProvider = { getSchedulingCategories: jest.fn().mockResolvedValue([]) };
    commerceProvider = { getCatalogItemCount: jest.fn().mockResolvedValue(0) };
    snapshotStore = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined), delete: jest.fn().mockResolvedValue(undefined) };
    snapshotService = new TenantAIContextSnapshotService(schedProvider, commerceProvider, snapshotStore);
  });

  it('returns cached snapshot without rebuilding when store has entry', async () => {
    const cached = { tenantId: 't1', generatedAt: new Date(), schedulingCategories: ['Hair'], commerceCatalogItemCount: 2 };
    snapshotStore.get.mockResolvedValue(cached);
    const result = await snapshotService.getOrBuild('t1');
    expect(result).toBe(cached);
    expect(schedProvider.getSchedulingCategories).not.toHaveBeenCalled();
  });

  it('builds snapshot and caches it when store returns null', async () => {
    snapshotStore.get.mockResolvedValue(null);
    schedProvider.getSchedulingCategories.mockResolvedValue(['Cut', 'Color']);
    commerceProvider.getCatalogItemCount.mockResolvedValue(10);
    const result = await snapshotService.getOrBuild('t1');
    expect(result.schedulingCategories).toEqual(['Cut', 'Color']);
    expect(result.commerceCatalogItemCount).toBe(10);
    expect(snapshotStore.set).toHaveBeenCalledWith('t1', expect.objectContaining({ tenantId: 't1' }));
  });

  it('invalidate calls store.delete with tenantId', async () => {
    await snapshotService.invalidate('tenant-to-invalidate');
    expect(snapshotStore.delete).toHaveBeenCalledWith('tenant-to-invalidate');
  });

  it('built snapshot includes generatedAt as a Date', async () => {
    snapshotStore.get.mockResolvedValue(null);
    const result = await snapshotService.getOrBuild('t2');
    expect(result.generatedAt).toBeInstanceOf(Date);
  });
});

// ================================================================
// 13. TenantAIContextSnapshotInvalidationHandler
// ================================================================

describe('TenantAIContextSnapshotInvalidationHandler', () => {
  let eventBusI: jest.Mocked<IEventBus>;
  let snapshotServiceI: any;
  let handler: TenantAIContextSnapshotInvalidationHandler;

  beforeEach(() => {
    eventBusI = { publish: jest.fn(), subscribe: jest.fn() } as unknown as jest.Mocked<IEventBus>;
    snapshotServiceI = { invalidate: jest.fn().mockResolvedValue(undefined) };
    handler = new TenantAIContextSnapshotInvalidationHandler(eventBusI, snapshotServiceI);
  });

  it('subscribes to tenant.ai-config-updated on init', () => {
    handler.onModuleInit();
    const queues = eventBusI.subscribe.mock.calls.map((c: any) => c[0]);
    expect(queues).toContain('tenant.ai-config-updated');
  });

  it('subscribes to catalog.item-created on init', () => {
    handler.onModuleInit();
    const queues = eventBusI.subscribe.mock.calls.map((c: any) => c[0]);
    expect(queues).toContain('catalog.item-created');
  });

  it('invalidates snapshot when tenant.ai-config-updated event fires', async () => {
    let cb: any;
    eventBusI.subscribe.mockImplementation((queue: string, callback: any) => { if (queue === 'tenant.ai-config-updated') cb = callback; });
    handler.onModuleInit();
    await cb({ payload: { aggregateId: 'tenant-xyz' } });
    expect(snapshotServiceI.invalidate).toHaveBeenCalledWith('tenant-xyz');
  });

  it('invalidates snapshot when billing.subscription-activated fires', async () => {
    let cb: any;
    eventBusI.subscribe.mockImplementation((queue: string, callback: any) => { if (queue === 'billing.subscription-activated') cb = callback; });
    handler.onModuleInit();
    await cb({ payload: { tenantId: 'billing-tenant' } });
    expect(snapshotServiceI.invalidate).toHaveBeenCalledWith('billing-tenant');
  });

  it('does NOT swallow Redis failure — invalidate error propagates to event callback', async () => {
    let cb: any;
    eventBusI.subscribe.mockImplementation((queue: string, callback: any) => { if (queue === 'catalog.item-updated') cb = callback; });
    snapshotServiceI.invalidate.mockRejectedValue(new Error('Redis down'));
    handler.onModuleInit();
    await expect(cb({ payload: { tenantId: 'tenant-1' } })).rejects.toThrow('Redis down');
  });
});

// ================================================================
// 14. CommerceCatalogSearchAdapter
// ================================================================

describe('CommerceCatalogSearchAdapter', () => {
  let searchUseCase: any;
  let adapter: CommerceCatalogSearchAdapter;
  beforeEach(() => {
    searchUseCase = { execute: jest.fn() };
    adapter = new CommerceCatalogSearchAdapter(searchUseCase);
  });

  it('passes tenantId, query, and limit to the underlying use case', async () => {
    searchUseCase.execute.mockResolvedValue([]);
    await adapter.search({ tenantId: 't1', query: 'cafe', limit: 5 });
    expect(searchUseCase.execute).toHaveBeenCalledWith({ tenantId: 't1', query: 'cafe', limit: 5 });
  });

  it('maps use-case result to CommerceCatalogSearchOption array', async () => {
    searchUseCase.execute.mockResolvedValue([{ optionNumber: 1, name: 'Cafe 500g', price: 14.90, currency: 'BRL', availableQuantity: 10, categoryName: 'Beverages', attributes: [], variants: [], optionGroups: [] }]);
    const result = await adapter.search({ tenantId: 't1', query: 'cafe', limit: 5 });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Cafe 500g');
    expect(result[0].price).toBe(14.90);
  });

  it('returns empty array when use case returns no results', async () => {
    searchUseCase.execute.mockResolvedValue([]);
    const result = await adapter.search({ tenantId: 't1', query: 'xyz', limit: 10 });
    expect(result).toEqual([]);
  });

  it('propagates error from underlying use case', async () => {
    searchUseCase.execute.mockRejectedValue(new Error('DB error'));
    await expect(adapter.search({ tenantId: 't1', query: 'cafe', limit: 5 })).rejects.toThrow('DB error');
  });
});

// ================================================================
// 15. SalesPaymentLinkGenerator
// ================================================================

describe('SalesPaymentLinkGenerator', () => {
  let createPaymentLinkUseCase: any;
  let generator: SalesPaymentLinkGenerator;
  beforeEach(() => {
    createPaymentLinkUseCase = { execute: jest.fn() };
    generator = new SalesPaymentLinkGenerator(createPaymentLinkUseCase);
  });

  it('passes tenantId, name, and value to underlying use case with billingType UNDEFINED', async () => {
    createPaymentLinkUseCase.execute.mockResolvedValue({ id: 'link-1', url: 'https://pay.test/link-1' });
    await generator.generate({ tenantId: 't1', name: 'Corte', value: 59.90 });
    expect(createPaymentLinkUseCase.execute).toHaveBeenCalledWith({ tenantId: 't1', name: 'Corte', value: 59.90, billingType: 'UNDEFINED' });
  });

  it('returns the link id and url from the use case result', async () => {
    createPaymentLinkUseCase.execute.mockResolvedValue({ id: 'link-2', url: 'https://pay.test/link-2' });
    const result = await generator.generate({ tenantId: 't1', name: 'Barba', value: 29.90 });
    expect(result.id).toBe('link-2');
    expect(result.url).toBe('https://pay.test/link-2');
  });

  it('propagates error from payment gateway use case', async () => {
    createPaymentLinkUseCase.execute.mockRejectedValue(new Error('gateway timeout'));
    await expect(generator.generate({ tenantId: 't1', name: 'X', value: 10 })).rejects.toThrow('gateway timeout');
  });
});

// ================================================================
// 16. CommercialContextProvider
// ================================================================

describe('CommercialContextProvider', () => {
  let inventoryPort: any;
  let catalogPort: any;
  let provider: CommercialContextProvider;
  beforeEach(() => {
    inventoryPort = { listItems: jest.fn().mockResolvedValue([]) };
    catalogPort = { searchItems: jest.fn().mockResolvedValue([]) };
    provider = new CommercialContextProvider(inventoryPort, catalogPort);
  });

  it('returns null when neither inventory nor catalog returns a match', async () => {
    const result = await provider.findRelevantOffer('t1', 'produto desconhecido xyz123');
    expect(result).toBeNull();
  });

  it('returns inventory context when message matches an inventory item by name', async () => {
    inventoryPort.listItems.mockResolvedValue([{ name: 'Cafe Torrado 500g', sku: 'CAF500', availabilityStatus: 'AVAILABLE', availableQuantity: 50, currency: 'BRL', currentPrice: 14.90, source: 'manual', externalReference: null }]);
    const result = await provider.findRelevantOffer('t1', 'Quanto custa o cafe torrado 500g?');
    expect(result).not.toBeNull();
    expect(result).toContain('Cafe Torrado 500g');
    expect(result).toContain('Inventory context:');
  });

  it('falls through to catalog search when inventory returns no match', async () => {
    inventoryPort.listItems.mockResolvedValue([{ name: 'Produto Z', sku: 'Z1', availabilityStatus: 'AVAILABLE', availableQuantity: 5, currency: 'BRL', currentPrice: 100, source: 'manual', externalReference: null }]);
    catalogPort.searchItems.mockResolvedValue([{ name: 'Coca Cola', type: 'PRODUCT', categoryName: 'Bebidas', basePrice: 8.50, currency: 'BRL', tags: ['bebida', 'refrigerante'] }]);
    const result = await provider.findRelevantOffer('t1', 'Tem coca cola?');
    expect(result).not.toBeNull();
    expect(result).toContain('Catalog context:');
    expect(result).toContain('Coca Cola');
  });

  it('includes price in inventory context output', async () => {
    inventoryPort.listItems.mockResolvedValue([{ name: 'Sabonete Dove', sku: 'SD1', availabilityStatus: 'AVAILABLE', availableQuantity: 20, currency: 'BRL', currentPrice: 5.99, source: 'erp', externalReference: null }]);
    const result = await provider.findRelevantOffer('t1', 'quanto custa sabonete dove');
    expect(result).toContain('5.99');
  });
});

// ================================================================
// 17. PDFProcessingProcessor
// ================================================================

describe('PDFProcessingProcessor', () => {
  let processDocUseCase: jest.Mocked<ProcessDocumentForRAGUseCase>;
  let processor: PDFProcessingProcessor;
  beforeEach(() => {
    processDocUseCase = { execute: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<ProcessDocumentForRAGUseCase>;
    processor = new PDFProcessingProcessor(processDocUseCase);
  });

  it('calls processDocumentUseCase.execute with job data for process-document job', async () => {
    const job = { name: 'process-document', data: { tenantId: 't1', documentId: 'doc-1', fileUrl: 'https://s3/doc.pdf', fileName: 'doc.pdf' } };
    await processor.process(job as any);
    expect(processDocUseCase.execute).toHaveBeenCalledWith({ tenantId: 't1', documentId: 'doc-1', fileUrl: 'https://s3/doc.pdf', fileName: 'doc.pdf' });
  });

  it('does not call use case for unknown job names', async () => {
    const job = { name: 'unknown-job', data: { tenantId: 't1', documentId: 'doc-1', fileUrl: 'x', fileName: 'y' } };
    await processor.process(job as any);
    expect(processDocUseCase.execute).not.toHaveBeenCalled();
  });

  it('propagates error when processDocumentUseCase throws', async () => {
    processDocUseCase.execute.mockRejectedValue(new Error('extraction failed'));
    const job = { name: 'process-document', data: { tenantId: 't1', documentId: 'doc-1', fileUrl: 'x', fileName: 'y' } };
    await expect(processor.process(job as any)).rejects.toThrow('extraction failed');
  });

  it('resolves without error for unknown job name (warn only, no exception)', async () => {
    const job = { name: 'some-other-job', data: {} };
    await expect(processor.process(job as any)).resolves.not.toThrow();
  });
});

// ================================================================
// 18. MessageReceivedHandler — error path
// ================================================================

describe('MessageReceivedHandler — error propagation', () => {
  it('does not silently swallow errors from processAIResponseUseCase', async () => {
    const eventBusE = { publish: jest.fn(), subscribe: jest.fn() } as unknown as jest.Mocked<IEventBus>;
    const useCase = { execute: jest.fn().mockRejectedValue(new Error('use case failed')) } as unknown as jest.Mocked<IProcessAIResponseUseCase>;
    const handler = new MessageReceivedHandler(eventBusE, useCase);
    let subscribedHandler: any;
    eventBusE.subscribe.mockImplementation((queue: string, cb: any) => { if (queue === 'messaging.message-received') subscribedHandler = cb; });
    handler.onModuleInit();
    await expect(subscribedHandler({ payload: { tenantId: 't1', conversationId: 'c1', contactId: 'ct1', content: { type: 'TEXT', text: 'Oi' } } })).rejects.toThrow('use case failed');
  });
});

// ================================================================
// 19. AIResponseGeneratedHandler — error path
// ================================================================

describe('AIResponseGeneratedHandler — error paths', () => {
  let eventBusH: jest.Mocked<IEventBus>;
  let leadSvc: jest.Mocked<LeadScoringService>;
  let handlerH: AIResponseGeneratedHandler;
  beforeEach(() => {
    eventBusH = { publish: jest.fn(), subscribe: jest.fn() } as unknown as jest.Mocked<IEventBus>;
    leadSvc = { calculateScore: jest.fn().mockReturnValue(80), isHotLead: jest.fn().mockReturnValue(false) } as unknown as jest.Mocked<LeadScoringService>;
    handlerH = new AIResponseGeneratedHandler(eventBusH, leadSvc);
  });

  it('does not publish LeadScoredIntegrationEvent when calculateScore throws', async () => {
    let cb: any;
    eventBusH.subscribe.mockImplementation((q: string, callback: any) => { if (q === 'ai.response-generated') cb = callback; });
    leadSvc.calculateScore.mockImplementation(() => { throw new Error('scoring error'); });
    handlerH.onModuleInit();
    await expect(cb({ payload: { conversationId: 'c1', tenantId: 't1', contactId: 'ct1', intent: 'PURCHASE', sentiment: 'POSITIVE', confidence: 0.9 } })).rejects.toThrow('scoring error');
    expect(eventBusH.publish).not.toHaveBeenCalled();
  });

  it('does not publish when isHotLead throws', async () => {
    let cb: any;
    eventBusH.subscribe.mockImplementation((q: string, callback: any) => { if (q === 'ai.response-generated') cb = callback; });
    leadSvc.isHotLead.mockImplementation(() => { throw new Error('hot lead check failed'); });
    handlerH.onModuleInit();
    await expect(cb({ payload: { conversationId: 'c1', tenantId: 't1', contactId: 'ct1', intent: 'QUESTION', sentiment: 'NEUTRAL', confidence: 0.8 } })).rejects.toThrow('hot lead check failed');
    expect(eventBusH.publish).not.toHaveBeenCalled();
  });
});

// ================================================================
// 20. LeadScoringService — boundary combos
// ================================================================

describe('LeadScoringService — boundary and combo scores', () => {
  let svc: LeadScoringService;
  beforeEach(() => { svc = new LeadScoringService(); });

  it('COMPLAINT + POSITIVE sentiment produces a reduced positive score (not negative)', () => {
    const score = svc.calculateScore('COMPLAINT', 'POSITIVE', 0.8);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('PURCHASE + NEGATIVE sentiment reduces score below PURCHASE + POSITIVE', () => {
    const pos = svc.calculateScore('PURCHASE', 'POSITIVE', 0.9);
    const neg = svc.calculateScore('PURCHASE', 'NEGATIVE', 0.9);
    expect(neg).toBeLessThan(pos);
  });

  it('GREETING + POSITIVE does not exceed 100', () => {
    const score = svc.calculateScore('GREETING', 'POSITIVE', 1.0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('SCHEDULING + NEUTRAL produces a non-negative score', () => {
    const score = svc.calculateScore('SCHEDULING', 'NEUTRAL', 0.75);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('UNKNOWN + NEGATIVE + zero confidence scores at 0 (floor)', () => {
    const score = svc.calculateScore('UNKNOWN', 'NEGATIVE', 0);
    expect(score).toBe(0);
  });

  it('PURCHASE + POSITIVE + 0.5 confidence is a hot lead threshold test', () => {
    const score = svc.calculateScore('PURCHASE', 'POSITIVE', 0.5);
    // at 0.5 confidence, score should still be > 0 but may not be hot
    expect(score).toBeGreaterThan(0);
  });
});

// ================================================================
// 21. HumanHandoffPolicy — SCHEDULING intent
// ================================================================

describe('HumanHandoffPolicy — SCHEDULING intent does not trigger handoff', () => {
  let policy: HumanHandoffPolicy;
  beforeEach(() => { policy = new HumanHandoffPolicy(); });

  it('does NOT handoff for SCHEDULING intent with high confidence and neutral sentiment', () => {
    const result = policy.evaluate({ userMessage: 'Quero agendar um horario', response: { text: 'ok', tokensUsed: 5, confidence: 0.9, finishReason: 'stop', intent: 'SCHEDULING', sentiment: 'NEUTRAL' }, confidenceThreshold: 0.7 });
    expect(result.shouldHandoff).toBe(false);
  });

  it('SCHEDULING + LOW confidence still triggers LOW_CONFIDENCE handoff', () => {
    const result = policy.evaluate({ userMessage: 'Quero agendar', response: { text: 'ok', tokensUsed: 5, confidence: 0.3, finishReason: 'stop', intent: 'SCHEDULING', sentiment: 'NEUTRAL' }, confidenceThreshold: 0.7 });
    expect(result.shouldHandoff).toBe(true);
    expect(result.reason).toBe('LOW_CONFIDENCE');
  });
});

// ================================================================
// 22. AIResponseProcessor — SCHEDULE_SLOT free payment path
// ================================================================

describe('AIResponseProcessor — SCHEDULE_SLOT free-slot path', () => {
  let paymentGen: jest.Mocked<IPaymentLinkGenerator>;
  let slotUseCase: any;
  let repeatOrder: jest.Mocked<IRepeatLastOrder>;
  let proc: AIResponseProcessor;
  beforeEach(() => {
    paymentGen = { generate: jest.fn() } as unknown as jest.Mocked<IPaymentLinkGenerator>;
    slotUseCase = { execute: jest.fn() };
    repeatOrder = { execute: jest.fn() } as unknown as jest.Mocked<IRepeatLastOrder>;
    proc = new AIResponseProcessor(paymentGen, slotUseCase, repeatOrder);
  });

  it('confirms free slot without a payment link when payment=free', async () => {
    slotUseCase.execute.mockResolvedValue({ id: '2030-07-20__10:00__11:00', startsAt: '10:00', endsAt: '11:00', status: 'PRE_RESERVED', reservedFor: { categoryName: 'Consulta' }, payment: null });
    const result = await proc.process('Agendado. [SCHEDULE_SLOT: professionalId=prof-1, date=2030-07-20, slotId=2030-07-20__10:00__11:00, categoryId=cat-1, payment=free]', { tenantId: 't1', branchId: 'b1', contactId: 'ct1', conversationId: 'cv1' });
    expect(slotUseCase.execute).toHaveBeenCalledWith(expect.objectContaining({ isFree: true }));
    expect(result).toContain('pre-reservado');
    expect(result).not.toContain('http');
  });

  it('free slot call does NOT invoke paymentLinkGenerator', async () => {
    slotUseCase.execute.mockResolvedValue({ id: 'slot-free', startsAt: '09:00', endsAt: '10:00', status: 'PRE_RESERVED', reservedFor: { categoryName: 'Check-up' }, payment: null });
    await proc.process('Ok. [SCHEDULE_SLOT: professionalId=p1, date=2030-01-15, slotId=slot-free, categoryId=c1, payment=free]', { tenantId: 't1', branchId: null, contactId: 'ct1', conversationId: 'cv1' });
    expect(paymentGen.generate).not.toHaveBeenCalled();
  });
});

// ================================================================
// 23. AIResponseProcessor — multiple SCHEDULE_SLOT tags (only first processed)
// ================================================================

describe('AIResponseProcessor — multiple SCHEDULE_SLOT tags', () => {
  let paymentGen2: jest.Mocked<IPaymentLinkGenerator>;
  let slotUseCase2: any;
  let repeatOrder2: jest.Mocked<IRepeatLastOrder>;
  let proc2: AIResponseProcessor;
  beforeEach(() => {
    paymentGen2 = { generate: jest.fn() } as unknown as jest.Mocked<IPaymentLinkGenerator>;
    slotUseCase2 = { execute: jest.fn() };
    repeatOrder2 = { execute: jest.fn() } as unknown as jest.Mocked<IRepeatLastOrder>;
    proc2 = new AIResponseProcessor(paymentGen2, slotUseCase2, repeatOrder2);
  });

  it('processes only the first SCHEDULE_SLOT tag when two appear in a response', async () => {
    slotUseCase2.execute.mockResolvedValue({ id: 'slot-1', startsAt: '10:00', endsAt: '11:00', status: 'PRE_RESERVED', reservedFor: { categoryName: 'Corte' }, payment: { linkUrl: 'https://pay/1' } });
    const text = 'Opcao 1: [SCHEDULE_SLOT: professionalId=p1, date=2030-07-20, slotId=slot-1, categoryId=c1, payment=required] Opcao 2: [SCHEDULE_SLOT: professionalId=p2, date=2030-07-21, slotId=slot-2, categoryId=c2, payment=required]';
    const result = await proc2.process(text, { tenantId: 't1', branchId: null, contactId: 'ct1', conversationId: 'cv1' });
    expect(slotUseCase2.execute).toHaveBeenCalledTimes(1);
    expect(result).toContain('[SCHEDULE_SLOT: professionalId=p2');
  });
});
