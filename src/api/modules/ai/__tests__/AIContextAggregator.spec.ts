jest.mock('@shared/infrastructure/observability/DomainTrace', () => ({
  traceAsync: (_name: string, _attrs: any, fn: () => Promise<any>) => fn(),
}));

import { AIContextAggregator } from '../application/services/AIContextAggregator';
import { PromptBuilder } from '../domain/services/PromptBuilder';
import { ICommercialContextProvider } from '../application/ports/ICommercialContextProvider';
import { ICommerceContextProvider } from '../application/ports/ICommerceContextProvider';
import { ISchedulingContextProvider } from '../application/ports/ISchedulingContextProvider';
import { ITenantPDFContextProvider } from '../application/ports/ITenantPDFContextProvider';

function makeTenantStub(id = 'tenant-1') {
  return {
    id: { toString: () => id },
    businessType: 'MARKET',
  } as any;
}

describe('AIContextAggregator', () => {
  let promptBuilder: jest.Mocked<PromptBuilder>;
  let commercialProvider: jest.Mocked<ICommercialContextProvider>;
  let commerceProvider: jest.Mocked<ICommerceContextProvider>;
  let schedulingProvider: jest.Mocked<ISchedulingContextProvider>;
  let pdfProvider: jest.Mocked<ITenantPDFContextProvider>;

  beforeEach(() => {
    promptBuilder = { build: jest.fn().mockReturnValue('Base prompt') } as any;
    commercialProvider = { findRelevantOffer: jest.fn().mockResolvedValue(null) };
    commerceProvider = { findConversationContext: jest.fn().mockResolvedValue(null) };
    schedulingProvider = { findRelevantAvailability: jest.fn().mockResolvedValue(null) };
    pdfProvider = { findRelevantPDFContext: jest.fn().mockResolvedValue(null) };
  });

  function createAggregator(ttl = 0, withPdf = true) {
    return new AIContextAggregator(
      promptBuilder,
      commercialProvider,
      commerceProvider,
      schedulingProvider,
      withPdf ? pdfProvider : undefined,
      ttl,
    );
  }

  describe('aggregate without cache (ttl=0)', () => {
    it('should call all providers and return built context', async () => {
      const aggregator = createAggregator(0);
      const tenant = makeTenantStub();

      const result = await aggregator.aggregate(tenant, 'conv-1', 'Olá', false);

      expect(promptBuilder.build).toHaveBeenCalledWith(tenant);
      expect(commercialProvider.findRelevantOffer).toHaveBeenCalledWith('tenant-1', 'Olá');
      expect(commerceProvider.findConversationContext).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        conversationId: 'conv-1',
        userMessage: 'Olá',
        businessType: 'MARKET',
      });
      expect(schedulingProvider.findRelevantAvailability).toHaveBeenCalledWith('tenant-1', 'Olá');
      expect(pdfProvider.findRelevantPDFContext).toHaveBeenCalledWith('tenant-1', 'Olá');
      expect(result.systemPrompt).toBe('Base prompt');
      expect(result.diagnostics.basePromptUsage).toBe(true);
    });

    it('should not include cache diagnostics when ttl is 0', async () => {
      const aggregator = createAggregator(0);

      const result = await aggregator.aggregate(makeTenantStub(), 'conv-1', 'Oi', false);

      expect(result.diagnostics.aiContextAggregatorCacheHit).toBeUndefined();
      expect(result.diagnostics.aiContextAggregatorCacheTtlMs).toBeUndefined();
    });
  });

  describe('cache hit', () => {
    it('should return cached result on second call within TTL', async () => {
      const aggregator = createAggregator(60_000);
      const tenant = makeTenantStub();

      await aggregator.aggregate(tenant, 'conv-1', 'Olá', false);
      promptBuilder.build.mockClear();
      commercialProvider.findRelevantOffer.mockClear();

      const result = await aggregator.aggregate(tenant, 'conv-1', 'Olá', false);

      expect(promptBuilder.build).not.toHaveBeenCalled();
      expect(commercialProvider.findRelevantOffer).not.toHaveBeenCalled();
      expect(result.diagnostics.aiContextAggregatorCacheHit).toBe(true);
    });
  });

  describe('cache miss (expired)', () => {
    it('should rebuild context when cache entry has expired', async () => {
      const aggregator = createAggregator(1); // 1ms TTL
      const tenant = makeTenantStub();

      await aggregator.aggregate(tenant, 'conv-1', 'Olá', false);

      // Wait for TTL to expire
      await new Promise((r) => setTimeout(r, 10));

      promptBuilder.build.mockClear();
      const result = await aggregator.aggregate(tenant, 'conv-1', 'Olá', false);

      expect(promptBuilder.build).toHaveBeenCalled();
      expect(result.diagnostics.aiContextAggregatorCacheHit).toBe(false);
    });
  });

  describe('cache eviction (>200 entries)', () => {
    it('should evict oldest entries when cache exceeds 200', async () => {
      const aggregator = createAggregator(60_000);

      for (let i = 0; i < 201; i++) {
        const tenant = makeTenantStub(`tenant-${i}`);
        await aggregator.aggregate(tenant, `conv-${i}`, `msg-${i}`, false);
      }

      // The first entry should have been evicted; calling it again should rebuild
      promptBuilder.build.mockClear();
      const tenant0 = makeTenantStub('tenant-0');
      const result = await aggregator.aggregate(tenant0, 'conv-0', 'msg-0', false);

      expect(promptBuilder.build).toHaveBeenCalled();
      expect(result.diagnostics.aiContextAggregatorCacheHit).toBe(false);
    });
  });

  describe('isFirstInteraction guardrail', () => {
    it('should append first interaction guardrail when isFirstInteraction=true', async () => {
      const aggregator = createAggregator(0);

      const result = await aggregator.aggregate(makeTenantStub(), 'conv-1', 'Oi', true);

      expect(result.systemPrompt).toContain('[PRIMEIRA INTERAção]');
      expect(result.diagnostics.firstInteractionGuardrail).toBe(true);
    });

    it('should NOT append first interaction guardrail when isFirstInteraction=false', async () => {
      const aggregator = createAggregator(0);

      const result = await aggregator.aggregate(makeTenantStub(), 'conv-1', 'Oi', false);

      expect(result.systemPrompt).not.toContain('[PRIMEIRA INTERAção]');
      expect(result.diagnostics.firstInteractionGuardrail).toBe(false);
    });
  });

  describe('context providers found', () => {
    it('should append commercial context when provider returns data', async () => {
      commercialProvider.findRelevantOffer.mockResolvedValue('Oferta: 20% desconto');
      const aggregator = createAggregator(0);

      const result = await aggregator.aggregate(makeTenantStub(), 'conv-1', 'promoção', false);

      expect(result.systemPrompt).toContain('[CONTEXTO COMERCIAL]');
      expect(result.systemPrompt).toContain('Oferta: 20% desconto');
      expect(result.diagnostics.commercialContextFound).toBe(true);
    });

    it('should append commerce context when provider returns data', async () => {
      commerceProvider.findConversationContext.mockResolvedValue('Carrinho: 2 itens');
      const aggregator = createAggregator(0);

      const result = await aggregator.aggregate(makeTenantStub(), 'conv-1', 'meu pedido', false);

      expect(result.systemPrompt).toContain('[CONTEXTO DE NEGOCIO]');
      expect(result.systemPrompt).toContain('Carrinho: 2 itens');
      expect(result.diagnostics.commerceContextFound).toBe(true);
    });

    it('should append scheduling context when provider returns data', async () => {
      schedulingProvider.findRelevantAvailability.mockResolvedValue('Horários: 14h, 15h');
      const aggregator = createAggregator(0);

      const result = await aggregator.aggregate(makeTenantStub(), 'conv-1', 'agendar', false);

      expect(result.systemPrompt).toContain('[CONTEXTO DE AGENDA]');
      expect(result.systemPrompt).toContain('Horários: 14h, 15h');
      expect(result.diagnostics.schedulingContextFound).toBe(true);
    });

    it('should append PDF context when provider returns data', async () => {
      pdfProvider.findRelevantPDFContext.mockResolvedValue('Documento: política de troca');
      const aggregator = createAggregator(0);

      const result = await aggregator.aggregate(makeTenantStub(), 'conv-1', 'troca', false);

      expect(result.systemPrompt).toContain('[CONTEXTO DE DOCUMENTOS DA EMPRESA]');
      expect(result.systemPrompt).toContain('Documento: política de troca');
      expect(result.diagnostics.tenantPDFContextFound).toBe(true);
    });
  });

  describe('context providers not found', () => {
    it('should not append commercial context when provider returns null', async () => {
      const aggregator = createAggregator(0);

      const result = await aggregator.aggregate(makeTenantStub(), 'conv-1', 'Oi', false);

      expect(result.systemPrompt).not.toContain('[CONTEXTO COMERCIAL]');
      expect(result.diagnostics.commercialContextFound).toBeUndefined();
    });

    it('should not append PDF context when provider is undefined', async () => {
      const aggregator = createAggregator(0, false);

      const result = await aggregator.aggregate(makeTenantStub(), 'conv-1', 'Oi', false);

      expect(result.systemPrompt).not.toContain('[CONTEXTO DE DOCUMENTOS DA EMPRESA]');
      expect(result.diagnostics.tenantPDFContextFound).toBeUndefined();
    });
  });

  describe('all providers return null', () => {
    it('should return only base prompt with no extra context sections', async () => {
      const aggregator = createAggregator(0);

      const result = await aggregator.aggregate(makeTenantStub(), 'conv-1', 'Oi', false);

      expect(result.systemPrompt).toBe('Base prompt');
      expect(result.diagnostics.commercialContextFound).toBeUndefined();
      expect(result.diagnostics.commerceContextFound).toBeUndefined();
      expect(result.diagnostics.schedulingContextFound).toBeUndefined();
      expect(result.diagnostics.tenantPDFContextFound).toBeUndefined();
    });
  });

  describe('diagnostics correctness', () => {
    it('should include version and basePromptUsage in diagnostics', async () => {
      const aggregator = createAggregator(0);

      const result = await aggregator.aggregate(makeTenantStub(), 'conv-1', 'Oi', false);

      expect(result.diagnostics.aiContextAggregatorVersion).toBe('2026-05-context-v1');
      expect(result.diagnostics.basePromptUsage).toBe(true);
    });

    it('should include cache TTL in diagnostics when cache is enabled', async () => {
      const aggregator = createAggregator(5000);

      const result = await aggregator.aggregate(makeTenantStub(), 'conv-1', 'Oi', false);

      expect(result.diagnostics.aiContextAggregatorCacheHit).toBe(false);
      expect(result.diagnostics.aiContextAggregatorCacheTtlMs).toBe(5000);
      expect(result.diagnostics.aiContextAggregatorCacheExpiresAtMs).toBeGreaterThan(Date.now() - 1000);
    });
  });
});
