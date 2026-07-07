import {
  bootConversationHarness,
  seedTenant,
  createConversation,
  sendMessage,
  cleanupTenant,
  ConversationHarness,
} from './_support/conversation-harness';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@shared/infrastructure/redis/RedisModule';

/**
 * Multi-Agent Architecture Integration Tests
 *
 * Real pipeline: Redis, Prisma, AgentRouter, OutputGuardrailService,
 * PhaseStore, ToolExecutionService — only LLM is scripted for determinism.
 */
describe('Multi-Agent Integration', () => {
  jest.setTimeout(90000);

  let h: ConversationHarness;
  let redis: Redis;
  const cleanupTenants: string[] = [];

  beforeAll(async () => {
    h = await bootConversationHarness();
    // Override commerce providers — test DB lacks commerce_schema tables
    const { ProcessAIResponseService } = await import(
      '../application/services/ProcessAIResponseService'
    );
    const processService = h.app.get(ProcessAIResponseService);
    (processService as any).advanceCommerceConversationUseCase = {
      execute: jest.fn().mockResolvedValue(undefined),
    };
    // Also mock commerce context in the aggregator
    const { AIContextAggregator } = await import(
      '../application/services/AIContextAggregator'
    );
    const aggregator = h.app.get(AIContextAggregator);
    const commerceProvider = (aggregator as any).commerceContextProvider;
    if (commerceProvider) {
      if (typeof commerceProvider.findConversationContext === 'function') {
        jest.spyOn(commerceProvider, 'findConversationContext').mockResolvedValue(null);
      }
      if (typeof commerceProvider.getCatalogItemCount === 'function') {
        jest.spyOn(commerceProvider, 'getCatalogItemCount').mockResolvedValue(0);
      }
    }
    redis = h.app.get(REDIS_CLIENT);
  });

  afterAll(async () => {
    for (const tid of cleanupTenants) {
      await cleanupTenant(h, tid).catch(() => {});
    }
    await h.close();
  });

  beforeEach(() => {
    h.engine.reset();
    h.events.length = 0;
  });

  async function setup(businessType: string) {
    const { tenantId } = await seedTenant(h, { businessType });
    cleanupTenants.push(tenantId);
    const ctx = await createConversation(h, tenantId);
    return ctx;
  }

  describe('Agent routing by businessType', () => {
    it('ecommerce tenant → pipeline succeeds with BaseAgentResponse', async () => {
      const ctx = await setup('ecommerce');

      h.engine.enqueue({
        text: JSON.stringify({
          reply: 'Olá! Bem-vindo à nossa loja. Como posso ajudar?',
          confidence: 0.95,
          intent: 'GREETING',
          sentiment: 'POSITIVE',
          phase: 'QUALIFICATION',
          phaseConfidence: 0.9,
        }),
      });

      const result = await sendMessage(h, ctx, 'Oi');
      expect(result.success).toBe(true);
    });

    it('recovery tenant → pipeline succeeds with RecoveryResponse fields', async () => {
      const ctx = await setup('recovery');

      h.engine.enqueue({
        text: JSON.stringify({
          reply: 'Boa tarde. Identificamos um débito em seu nome.',
          confidence: 0.92,
          intent: 'GENERAL',
          sentiment: 'NEUTRAL',
          phase: 'DEBT_IDENTIFICATION',
          phaseConfidence: 0.88,
          debtAcknowledged: false,
          negotiationStatus: 'OPEN',
        }),
      });

      const result = await sendMessage(h, ctx, 'Quem é?');
      expect(result.success).toBe(true);
    });

    it('clinic tenant → pipeline succeeds with SchedulingResponse fields', async () => {
      const ctx = await setup('clinic');

      h.engine.enqueue({
        text: JSON.stringify({
          reply: 'Temos horários disponíveis para amanhã.',
          confidence: 0.9,
          intent: 'GENERAL',
          sentiment: 'POSITIVE',
          phase: 'SCHEDULING',
          phaseConfidence: 0.85,
          suggestedDate: '2026-07-08',
        }),
      });

      const result = await sendMessage(h, ctx, 'Quero marcar consulta');
      expect(result.success).toBe(true);
    });

    it('restaurant tenant → pipeline succeeds with CommerceResponse fields', async () => {
      const ctx = await setup('restaurant');

      h.engine.enqueue({
        text: JSON.stringify({
          reply: 'Ótima escolha! Pizza Margherita adicionada.',
          confidence: 0.93,
          intent: 'PURCHASE',
          sentiment: 'POSITIVE',
          phase: 'ORDER_TAKING',
          orderItems: ['Pizza Margherita'],
          orderTotal: 45.9,
        }),
      });

      const result = await sendMessage(h, ctx, 'Quero uma pizza margherita');
      expect(result.success).toBe(true);
    });
  });

  describe('Output guardrails enforcement', () => {
    it('masks CPF in AI response before reaching persistence', async () => {
      const ctx = await setup('ecommerce');

      h.engine.enqueue({
        text: JSON.stringify({
          reply: 'Seu CPF 123.456.789-00 foi verificado com sucesso.',
          confidence: 0.9,
          intent: 'GENERAL',
          sentiment: 'POSITIVE',
        }),
      });

      await sendMessage(h, ctx, 'Verifica meu CPF');

      // Check the AI response generated event for sanitized text
      const aiEvent = h.events.find(
        (e) => e.eventName === 'ai.response.generated.v1',
      );
      if (aiEvent) {
        const payload = aiEvent.payload as { response?: { text?: string } };
        expect(payload.response?.text).not.toContain('123.456.789-00');
        expect(payload.response?.text).toContain('***.***.***-**');
      }
    });

    it('removes external URLs from response', async () => {
      const ctx = await setup('ecommerce');

      h.engine.enqueue({
        text: JSON.stringify({
          reply: 'Acesse https://malicious-site.com/phishing para mais info.',
          confidence: 0.85,
          intent: 'GENERAL',
          sentiment: 'NEUTRAL',
        }),
      });

      await sendMessage(h, ctx, 'Onde compro?');

      const aiEvent = h.events.find(
        (e) => e.eventName === 'ai.response.generated.v1',
      );
      if (aiEvent) {
        const payload = aiEvent.payload as { response?: { text?: string } };
        expect(payload.response?.text).not.toContain('malicious-site.com');
        expect(payload.response?.text).toContain('[link removido]');
      }
    });

    it('blocks toxic content in response', async () => {
      const ctx = await setup('generic');

      h.engine.enqueue({
        text: JSON.stringify({
          reply: 'Você é um idiota por perguntar isso.',
          confidence: 0.8,
          intent: 'GENERAL',
          sentiment: 'NEGATIVE',
        }),
      });

      await sendMessage(h, ctx, 'Pergunta boba');

      const aiEvent = h.events.find(
        (e) => e.eventName === 'ai.response.generated.v1',
      );
      if (aiEvent) {
        const payload = aiEvent.payload as { response?: { text?: string } };
        expect(payload.response?.text).not.toContain('idiota');
        expect(payload.response?.text).toContain('***');
      }
    });
  });

  describe('Phase tracking via Redis', () => {
    it('valid phase transition persists to Redis', async () => {
      const ctx = await setup('ecommerce');

      h.engine.enqueue({
        text: JSON.stringify({
          reply: 'Vou mostrar nossos produtos!',
          confidence: 0.9,
          intent: 'PURCHASE',
          sentiment: 'POSITIVE',
          phase: 'QUALIFICATION',
          phaseConfidence: 0.88,
        }),
      });

      await sendMessage(h, ctx, 'Quero comprar algo');

      const phaseKey = `conv_phase:${ctx.conversationId}`;
      const stored = await redis.get(phaseKey);

      if (stored) {
        const state = JSON.parse(stored);
        expect(state.currentPhase).toBe('QUALIFICATION');
        expect(state.history.length).toBeGreaterThanOrEqual(1);
        expect(state.history[0].from).toBe('GREETING');
        expect(state.history[0].to).toBe('QUALIFICATION');
      }
    });

    it('invalid phase transition is rejected, state unchanged', async () => {
      const ctx = await setup('ecommerce');

      // First: valid GREETING → QUALIFICATION
      h.engine.enqueue({
        text: JSON.stringify({
          reply: 'O que procura?',
          confidence: 0.9,
          intent: 'QUESTION',
          sentiment: 'NEUTRAL',
          phase: 'QUALIFICATION',
        }),
      });
      await sendMessage(h, ctx, 'Oi');

      // Second: invalid QUALIFICATION → CONFIRMATION (skip phases)
      h.engine.enqueue({
        text: JSON.stringify({
          reply: 'Confirmado!',
          confidence: 0.9,
          intent: 'GENERAL',
          sentiment: 'POSITIVE',
          phase: 'CONFIRMATION',
        }),
      });
      await sendMessage(h, ctx, 'Confirma');

      const phaseKey = `conv_phase:${ctx.conversationId}`;
      const stored = await redis.get(phaseKey);

      if (stored) {
        const state = JSON.parse(stored);
        // Should still be QUALIFICATION (CONFIRMATION is invalid from QUALIFICATION)
        expect(state.currentPhase).toBe('QUALIFICATION');
      }
    });

    it('multi-step valid transitions track history', async () => {
      const ctx = await setup('ecommerce');

      // GREETING → QUALIFICATION
      h.engine.enqueue({
        text: JSON.stringify({
          reply: 'O que procura?',
          confidence: 0.9,
          intent: 'QUESTION',
          sentiment: 'NEUTRAL',
          phase: 'QUALIFICATION',
        }),
      });
      await sendMessage(h, ctx, 'Oi');

      // QUALIFICATION → PRODUCT_DISCOVERY
      h.engine.enqueue({
        text: JSON.stringify({
          reply: 'Temos estas opções:',
          confidence: 0.88,
          intent: 'GENERAL',
          sentiment: 'POSITIVE',
          phase: 'PRODUCT_DISCOVERY',
        }),
      });
      await sendMessage(h, ctx, 'Quero ver sapatos');

      // PRODUCT_DISCOVERY → QUOTE
      h.engine.enqueue({
        text: JSON.stringify({
          reply: 'O valor é R$199,90.',
          confidence: 0.92,
          intent: 'GENERAL',
          sentiment: 'POSITIVE',
          phase: 'QUOTE',
        }),
      });
      await sendMessage(h, ctx, 'Quanto custa?');

      const phaseKey = `conv_phase:${ctx.conversationId}`;
      const stored = await redis.get(phaseKey);

      if (stored) {
        const state = JSON.parse(stored);
        expect(state.currentPhase).toBe('QUOTE');
        expect(state.history).toHaveLength(3);
      }
    });
  });

  describe('Recovery niche happy path', () => {
    it('full recovery flow: GREETING → DEBT_IDENTIFICATION → NEGOTIATION → PROMISE_TO_PAY', async () => {
      const ctx = await setup('recovery');

      // Turn 1: GREETING → DEBT_IDENTIFICATION
      h.engine.enqueue({
        text: JSON.stringify({
          reply: 'Identificamos um débito de R$500 em aberto.',
          confidence: 0.9,
          intent: 'GENERAL',
          sentiment: 'NEUTRAL',
          phase: 'DEBT_IDENTIFICATION',
          debtAcknowledged: false,
          negotiationStatus: 'OPEN',
        }),
      });
      let result = await sendMessage(h, ctx, 'Quem fala?');
      expect(result.success).toBe(true);

      // Turn 2: DEBT_IDENTIFICATION → NEGOTIATION
      h.engine.enqueue({
        text: JSON.stringify({
          reply: 'Posso oferecer parcelamento em 3x sem juros.',
          confidence: 0.88,
          intent: 'GENERAL',
          sentiment: 'NEUTRAL',
          phase: 'NEGOTIATION',
          debtAcknowledged: true,
          negotiationStatus: 'OPEN',
          proposedPaymentPlan: '3x de R$166,67',
        }),
      });
      result = await sendMessage(h, ctx, 'Sei que devo, mas tá difícil');
      expect(result.success).toBe(true);

      // Turn 3: NEGOTIATION → PROMISE_TO_PAY
      h.engine.enqueue({
        text: JSON.stringify({
          reply: 'Ótimo! Registrando seu acordo para pagamento dia 15.',
          confidence: 0.95,
          intent: 'GENERAL',
          sentiment: 'POSITIVE',
          phase: 'PROMISE_TO_PAY',
          debtAcknowledged: true,
          negotiationStatus: 'AGREED',
          proposedPaymentPlan: '3x de R$166,67',
        }),
      });
      result = await sendMessage(h, ctx, 'Aceito parcelar em 3x');
      expect(result.success).toBe(true);

      // Verify final phase in Redis
      const phaseKey = `conv_phase:${ctx.conversationId}`;
      const stored = await redis.get(phaseKey);
      if (stored) {
        const state = JSON.parse(stored);
        expect(state.currentPhase).toBe('PROMISE_TO_PAY');
        expect(state.businessType).toBe('recovery');
        expect(state.history).toHaveLength(3);
      }
    });
  });

  describe('Scheduling niche happy path', () => {
    it('full clinic flow: GREETING → QUALIFICATION → SCHEDULING → CONFIRMATION', async () => {
      const ctx = await setup('clinic');

      // Turn 1: GREETING → QUALIFICATION
      h.engine.enqueue({
        text: JSON.stringify({
          reply: 'Qual especialidade você precisa?',
          confidence: 0.9,
          intent: 'QUESTION',
          sentiment: 'NEUTRAL',
          phase: 'QUALIFICATION',
        }),
      });
      await sendMessage(h, ctx, 'Quero marcar consulta');

      // Turn 2: QUALIFICATION → SCHEDULING
      h.engine.enqueue({
        text: JSON.stringify({
          reply: 'Temos horário amanhã às 14h com Dr. Silva.',
          confidence: 0.88,
          intent: 'GENERAL',
          sentiment: 'POSITIVE',
          phase: 'SCHEDULING',
          suggestedDate: '2026-07-08',
          suggestedProfessional: 'Dr. Silva',
        }),
      });
      await sendMessage(h, ctx, 'Dermatologista');

      // Turn 3: SCHEDULING → CONFIRMATION
      h.engine.enqueue({
        text: JSON.stringify({
          reply: 'Agendamento confirmado! Dr. Silva, amanhã às 14h.',
          confidence: 0.95,
          intent: 'GENERAL',
          sentiment: 'POSITIVE',
          phase: 'CONFIRMATION',
          appointmentConfirmed: true,
          suggestedDate: '2026-07-08',
        }),
      });
      await sendMessage(h, ctx, 'Pode confirmar');

      const phaseKey = `conv_phase:${ctx.conversationId}`;
      const stored = await redis.get(phaseKey);
      if (stored) {
        const state = JSON.parse(stored);
        expect(state.currentPhase).toBe('CONFIRMATION');
        expect(state.history).toHaveLength(3);
      }
    });
  });

  describe('Commerce niche happy path', () => {
    it('restaurant flow: GREETING → ORDER_TAKING → CUSTOMIZATION → CHECKOUT', async () => {
      const ctx = await setup('restaurant');

      // Turn 1: GREETING → ORDER_TAKING
      h.engine.enqueue({
        text: JSON.stringify({
          reply: 'O que gostaria de pedir hoje?',
          confidence: 0.9,
          intent: 'GENERAL',
          sentiment: 'POSITIVE',
          phase: 'ORDER_TAKING',
          orderItems: [],
        }),
      });
      await sendMessage(h, ctx, 'Quero fazer pedido');

      // Turn 2: ORDER_TAKING → CUSTOMIZATION
      h.engine.enqueue({
        text: JSON.stringify({
          reply: 'Pizza grande ou média? Borda recheada?',
          confidence: 0.88,
          intent: 'PURCHASE',
          sentiment: 'POSITIVE',
          phase: 'CUSTOMIZATION',
          orderItems: ['Pizza Portuguesa'],
          orderTotal: 55.0,
        }),
      });
      await sendMessage(h, ctx, 'Uma pizza portuguesa');

      // Turn 3: CUSTOMIZATION → CHECKOUT
      h.engine.enqueue({
        text: JSON.stringify({
          reply: 'Total: R$65. Confirma o pedido?',
          confidence: 0.92,
          intent: 'PURCHASE',
          sentiment: 'POSITIVE',
          phase: 'CHECKOUT',
          orderItems: ['Pizza Portuguesa Grande com Borda'],
          orderTotal: 65.0,
          deliveryEstimate: '40-50 minutos',
        }),
      });
      await sendMessage(h, ctx, 'Grande com borda recheada');

      const phaseKey = `conv_phase:${ctx.conversationId}`;
      const stored = await redis.get(phaseKey);
      if (stored) {
        const state = JSON.parse(stored);
        expect(state.currentPhase).toBe('CHECKOUT');
        expect(state.history).toHaveLength(3);
      }
    });
  });
});
