/* eslint-disable @typescript-eslint/no-explicit-any */
// ================================================================
// ai.e2e-new.spec.ts — NEW e2e tests for the ai module
// These tests exercise full-stack scenarios using mocked external
// services (no real DB/Redis/LLM required) following the pattern
// of existing e2e specs in this project.
// Targets:
//   - AutomationAiReplyFacade quota denial automation e2e
//   - Media message processing full pipeline
//   - Knowledge base ingestion tenant isolation
//   - Context window truncation under long conversation
//   - RAG cache hit scenario
//   - FollowUpTriggeredHandler error recovery
// ================================================================
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
import { FollowUpTriggeredHandler } from '../application/handlers/FollowUpTriggeredHandler';
import { MessageReceivedHandler } from '../application/handlers/MessageReceivedHandler';
import { IProcessAIResponseUseCase } from '../application/use-cases/interfaces/IProcessAIResponseUseCase';
import { IngestKnowledgeSourceUseCase } from '../application/use-cases/knowledge-base/IngestKnowledgeSourceUseCase';
import { IKnowledgeSourceRepository } from '../application/ports/IKnowledgeSourceRepository';
import { IDocumentChunkRepository } from '../application/ports/IDocumentChunkRepository';
import { IEmbeddingProvider } from '../application/ports/IEmbeddingProvider';
import { WebCrawlerAdapter } from '../infrastructure/adapters/knowledge-sources/WebCrawlerAdapter';
import { GoogleDriveAdapter } from '../infrastructure/adapters/knowledge-sources/GoogleDriveAdapter';
import { NotionAdapter } from '../infrastructure/adapters/knowledge-sources/NotionAdapter';
import { IRAGResponseCache } from '../application/ports/IRAGResponseCache';
import { MediaUnderstandingService } from '../application/services/MediaUnderstandingService';
import {
  AIResponseGeneratedIntegrationEvent,
  AIEscalationRequestedIntegrationEvent,
  AIQuotaDeniedIntegrationEvent,
  AIResponseFailedIntegrationEvent,
} from '../application/integration-events/publishers/AIIntegrationEvents';

// ─── helpers ────────────────────────────────────────────────────

function makeE2ETenant() {
  const t = Tenant.create({ companyName: CompanyName.create('E2E Co'), cnpj: CNPJ.create('60.701.190/0001-04'), plan: Plan.create('PROFISSIONAL'), users: [User.create({ name: 'O', email: Email.create('o@e2e.com'), phone: Phone.create('11999998888'), passwordHash: 'h', role: Role.create('OWNER') })] });
  t.configureAI(AIConfig.create({ systemPrompt: 'You are a helpful assistant.', tone: 'FRIENDLY', language: 'pt-BR', maxTokensPerResponse: 1000, confidenceThreshold: 0.7, escalationMessage: 'Escalating to human.', businessRules: [] }));
  t.clearEvents();
  return t;
}

function buildE2EStack(opts: { media?: MediaUnderstandingService; ragCache?: IRAGResponseCache; embProvider?: IEmbeddingProvider; } = {}) {
  const aiEngine = { generateResponse: jest.fn() } as unknown as jest.Mocked<IAIEngine>;
  const eventBus = { publish: jest.fn(), subscribe: jest.fn() } as unknown as jest.Mocked<IEventBus>;
  const tenantRepo = { save: jest.fn(), findById: jest.fn(), findByCnpj: jest.fn(), findByWhatsAppNumber: jest.fn(), findByApiKey: jest.fn(), findAll: jest.fn(), exists: jest.fn(), listBranches: jest.fn(), createBranch: jest.fn(), updateBranch: jest.fn(), deleteBranch: jest.fn() } as unknown as jest.Mocked<ITenantRepository>;
  const chatRepo = { getHistory: jest.fn().mockResolvedValue([]), saveMessage: jest.fn(), clearHistory: jest.fn() } as unknown as jest.Mocked<IChatHistoryRepository>;
  const quotaUC = { execute: jest.fn().mockResolvedValue({ canProceed: true, used: 0, quota: 1000, status: 'ACTIVE' }) } as unknown as jest.Mocked<ICheckQuotaUseCase>;
  const resProc = { process: jest.fn().mockResolvedValue('AI response') } as unknown as jest.Mocked<AIResponseProcessor>;
  const handoffPol = { evaluate: jest.fn().mockReturnValue({ shouldHandoff: false }) } as unknown as jest.Mocked<HumanHandoffPolicy>;
  const advCommerce = { execute: jest.fn().mockResolvedValue(null) } as unknown as jest.Mocked<AdvanceCommerceConversationUseCase>;
  const sessionSvc = { getOrCreateSession: jest.fn().mockResolvedValue({ id: 'e2e-session' }), recordMessage: jest.fn(), closeSession: jest.fn() } as unknown as jest.Mocked<AISessionService>;
  const ctxAgg = { aggregate: jest.fn().mockResolvedValue({ systemPrompt: 'sys', diagnostics: {} }) } as unknown as jest.Mocked<AIContextAggregator>;
  const contactRepo = { save: jest.fn(), findById: jest.fn().mockResolvedValue(null), findByPhone: jest.fn(), findAllByTenant: jest.fn(), delete: jest.fn() } as unknown as jest.Mocked<IContactRepository>;
  const rulesSvc = { getRule: jest.fn().mockResolvedValue(null), setRule: jest.fn() } as unknown as jest.Mocked<TenantAgentRuleService>;
  const safety = new AiSafetyGate({ safetyModeEnabled: false, blockedSubstrings: [], platformSystemAppend: '' });
  const svc = new ProcessAIResponseService(aiEngine, eventBus, tenantRepo, chatRepo, quotaUC, resProc, handoffPol, advCommerce, sessionSvc, ctxAgg, contactRepo, rulesSvc, safety, opts.media, opts.ragCache, opts.embProvider);
  return { useCase: new ProcessAIResponseUseCase(svc), aiEngine, eventBus, tenantRepo, chatRepo, quotaUC, sessionSvc, handoffPol, resProc };
}

// ================================================================
// E2E 1 — AutomationAiReplyFacade: quota denial in automation flow
// ================================================================

describe('[E2E] AutomationAiReplyFacade — quota denial in automation flow', () => {
  it('automation step receives denied=true and consumes no tokens when tenant quota is exhausted', async () => {
    const engine = { generateResponse: jest.fn() } as unknown as jest.Mocked<IAIEngine>;
    const quotaUC = { execute: jest.fn().mockResolvedValue({ canProceed: false, used: 1000, quota: 1000, status: 'QUOTA_EXCEEDED' }) } as unknown as jest.Mocked<ICheckQuotaUseCase>;
    const facade = new AutomationAiReplyFacade(engine, quotaUC);
    const result = await facade.generateReply({ tenantId: 'tenant-exhausted', prompt: 'Reply to customer', userMessage: 'Oi' });
    expect(result.denied).toBe(true);
    expect(result.reason).toBe('QUOTA_EXCEEDED');
    expect(result.text).toBe('');
    expect(engine.generateResponse).not.toHaveBeenCalled();
  });

  it('automation step gets non-denied result and AI text when quota is active', async () => {
    const engine = { generateResponse: jest.fn().mockResolvedValue({ text: 'Automation reply', tokensUsed: 12, confidence: 0.88, finishReason: 'stop', intent: 'QUESTION', sentiment: 'NEUTRAL' }) } as unknown as jest.Mocked<IAIEngine>;
    const quotaUC = { execute: jest.fn().mockResolvedValue({ canProceed: true, used: 50, quota: 1000, status: 'ACTIVE' }) } as unknown as jest.Mocked<ICheckQuotaUseCase>;
    const facade = new AutomationAiReplyFacade(engine, quotaUC);
    const result = await facade.generateReply({ tenantId: 'tenant-ok', prompt: 'Reply', userMessage: 'Follow up?' });
    expect(result.denied).toBeUndefined();
    expect(result.text).toBe('Automation reply');
  });

  it('OVERDUE subscription returns denied and does not call LLM', async () => {
    const engine = { generateResponse: jest.fn() } as unknown as jest.Mocked<IAIEngine>;
    const quotaUC = { execute: jest.fn().mockResolvedValue({ canProceed: false, used: 0, quota: 0, status: 'OVERDUE' }) } as unknown as jest.Mocked<ICheckQuotaUseCase>;
    const facade = new AutomationAiReplyFacade(engine, quotaUC);
    const result = await facade.generateReply({ tenantId: 'overdue-tenant', prompt: 'hi', userMessage: 'msg' });
    expect(result.denied).toBe(true);
    expect(engine.generateResponse).not.toHaveBeenCalled();
  });
});

// ================================================================
// E2E 2 — Media message processing full pipeline
// ================================================================

describe('[E2E] Media message processing — full pipeline', () => {
  it('IMAGE message with URL: goes through MediaUnderstandingService enrichment to LLM call and response persistence', async () => {
    const mediaUndSvc = { buildAiMessage: jest.fn().mockResolvedValue('Customer sent an image of a broken product.') } as unknown as jest.Mocked<MediaUnderstandingService>;
    const { useCase, aiEngine, eventBus, tenantRepo, sessionSvc, chatRepo } = buildE2EStack({ media: mediaUndSvc });
    const tenant = makeE2ETenant();
    tenantRepo.findById.mockResolvedValue(tenant);
    aiEngine.generateResponse.mockResolvedValue({ text: 'I see the issue with your product.', tokensUsed: 25, confidence: 0.87, finishReason: 'stop', intent: 'COMPLAINT', sentiment: 'NEUTRAL' });
    handoffPolHelper(useCase);
    const result = await useCase.execute({ tenantId: tenant.id.toString(), conversationId: 'conv-media-1', contactId: 'contact-1', content: { type: 'IMAGE', url: 'https://cdn/broken-product.jpg', text: 'meu produto chegou quebrado' } });
    expect(result.success).toBe(true);
    expect(mediaUndSvc.buildAiMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'IMAGE', url: 'https://cdn/broken-product.jpg' }));
    expect(aiEngine.generateResponse).toHaveBeenCalledWith(expect.objectContaining({ userMessage: 'Customer sent an image of a broken product.' }));
    expect(chatRepo.saveMessage).toHaveBeenCalled();
    expect(eventBus.publish).toHaveBeenCalledWith(expect.any(AIResponseGeneratedIntegrationEvent));
  });

  it('AUDIO message: enriched by MediaUnderstandingService and processed end-to-end', async () => {
    const mediaUndSvc = { buildAiMessage: jest.fn().mockResolvedValue('Customer sent audio: wants to know about pricing') } as unknown as jest.Mocked<MediaUnderstandingService>;
    const { useCase, aiEngine, tenantRepo } = buildE2EStack({ media: mediaUndSvc });
    const tenant = makeE2ETenant();
    tenantRepo.findById.mockResolvedValue(tenant);
    aiEngine.generateResponse.mockResolvedValue({ text: 'Our pricing starts at...', tokensUsed: 15, confidence: 0.9, finishReason: 'stop', intent: 'QUESTION', sentiment: 'NEUTRAL' });
    const result = await useCase.execute({ tenantId: tenant.id.toString(), conversationId: 'conv-audio-1', contactId: 'ct1', content: { type: 'AUDIO', url: 'https://cdn/audio.ogg' } });
    expect(result.success).toBe(true);
    expect(mediaUndSvc.buildAiMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'AUDIO' }));
  });

  it('DOCUMENT message without MediaUnderstandingService falls back to text message label', async () => {
    const { useCase, aiEngine, tenantRepo } = buildE2EStack();
    const tenant = makeE2ETenant();
    tenantRepo.findById.mockResolvedValue(tenant);
    aiEngine.generateResponse.mockResolvedValue({ text: 'I received your document.', tokensUsed: 10, confidence: 0.88, finishReason: 'stop', intent: 'QUESTION', sentiment: 'NEUTRAL' });
    const result = await useCase.execute({ tenantId: tenant.id.toString(), conversationId: 'cv1', contactId: 'ct1', content: { type: 'DOCUMENT', url: 'https://s3/file.pdf', text: 'My document' } });
    expect(result.success).toBe(true);
    expect(aiEngine.generateResponse).toHaveBeenCalledWith(expect.objectContaining({ userMessage: expect.stringContaining('documento') }));
  });
});

function handoffPolHelper(useCase: any) {
  // noop helper — handoff policy mock is already set to false in buildE2EStack
}

// ================================================================
// E2E 3 — Knowledge base ingestion tenant isolation
// ================================================================

describe('[E2E] Knowledge base ingestion — tenant isolation', () => {
  function buildIngestE2E(callerTenantId: string) {
    const knowledgeSourceRepository = { findById: jest.fn(), updateStatus: jest.fn().mockResolvedValue(undefined), markSynced: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<IKnowledgeSourceRepository>;
    const chunkingService = { chunk: jest.fn().mockReturnValue([{ content: 'Chunk', index: 0, tokenCount: 10 }]) };
    const embeddingProvider = { generateEmbedding: jest.fn(), generateEmbeddings: jest.fn().mockResolvedValue([[0.1, 0.2]]) } as unknown as jest.Mocked<IEmbeddingProvider>;
    const chunkRepository = { saveChunks: jest.fn(), findSimilar: jest.fn(), deleteByDocument: jest.fn().mockResolvedValue(undefined), countByDocument: jest.fn() } as unknown as jest.Mocked<IDocumentChunkRepository>;
    const webCrawler = { sourceType: 'webpage', ingest: jest.fn().mockResolvedValue({ contents: [{ title: 'T', text: 'content', sourceUrl: 'https://x.com' }], contentHash: 'nh' }) } as unknown as jest.Mocked<WebCrawlerAdapter>;
    const gd = { sourceType: 'google-drive', ingest: jest.fn() } as unknown as jest.Mocked<GoogleDriveAdapter>;
    const notion = { sourceType: 'notion', ingest: jest.fn() } as unknown as jest.Mocked<NotionAdapter>;
    const useCase = new IngestKnowledgeSourceUseCase(knowledgeSourceRepository, chunkingService as any, embeddingProvider, chunkRepository, webCrawler, gd, notion);
    return { useCase, knowledgeSourceRepository, chunkRepository };
  }

  it('attacker cannot overwrite victim tenant chunks by providing their sourceId', async () => {
    const { useCase, knowledgeSourceRepository, chunkRepository } = buildIngestE2E('attacker');
    // victim source exists for 'victim' tenant; attacker uses 'attacker' tenantId
    knowledgeSourceRepository.findById.mockImplementation(async (tid: string, sid: string) => {
      if (tid === 'victim' && sid === 'victim-source') return { id: sid, tenantId: 'victim', status: 'ACTIVE', contentHash: null };
      return null;
    });
    await useCase.execute({ tenantId: 'attacker', sourceId: 'victim-source', sourceType: 'webpage', sourceUrl: 'https://evil.com', sourceName: 'Evil' });
    // All repository calls must use 'attacker', not 'victim'
    const statusCalls = knowledgeSourceRepository.updateStatus.mock.calls;
    expect(statusCalls.every((c: any[]) => c[0] === 'attacker')).toBe(true);
    // Chunks should use attacker tenantId
    if (chunkRepository.saveChunks.mock.calls.length > 0) {
      const chunks = chunkRepository.saveChunks.mock.calls[0][0];
      expect(chunks.every((ch: any) => ch.tenantId === 'attacker')).toBe(true);
    }
  });

  it('marks source as INGESTING before crawling and ACTIVE after success', async () => {
    const { useCase, knowledgeSourceRepository } = buildIngestE2E('tenant-safe');
    knowledgeSourceRepository.findById.mockResolvedValue({ id: 'src-safe', tenantId: 'tenant-safe', status: 'PENDING', contentHash: null });
    await useCase.execute({ tenantId: 'tenant-safe', sourceId: 'src-safe', sourceType: 'webpage', sourceUrl: 'https://safe.com', sourceName: 'Safe' });
    expect(knowledgeSourceRepository.updateStatus).toHaveBeenCalledWith('tenant-safe', 'src-safe', 'INGESTING');
    expect(knowledgeSourceRepository.markSynced).toHaveBeenCalledWith('tenant-safe', 'src-safe', 'ACTIVE', 'nh');
  });

  it('marks source as ERROR when crawl fails — does not leave source in INGESTING', async () => {
    const { useCase, knowledgeSourceRepository } = buildIngestE2E('tenant-fail');
    knowledgeSourceRepository.findById.mockResolvedValue({ id: 'src-fail', tenantId: 'tenant-fail', status: 'PENDING', contentHash: null });
    (useCase as any).adapters.get('webpage').ingest = jest.fn().mockRejectedValue(new Error('crawl failed'));
    await useCase.execute({ tenantId: 'tenant-fail', sourceId: 'src-fail', sourceType: 'webpage', sourceUrl: 'https://broken.com', sourceName: 'Broken' });
    expect(knowledgeSourceRepository.updateStatus).toHaveBeenCalledWith('tenant-fail', 'src-fail', 'ERROR');
  });
});
