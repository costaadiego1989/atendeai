/**
 * Follow-Up Cross-Niche Live E2E Tests
 *
 * Testa o sistema de follow-up por inatividade em todos os nichos/estratégias.
 * Valida que o follow-up é contextual e respeita a estratégia do nicho.
 *
 * Cenários cobertos:
 * - F01: 1h sem resposta em commerce (FOOD)
 * - F02: 1h sem resposta em scheduling (BEAUTY)
 * - F03: 1h sem resposta em consultative (LEGAL)
 * - F04: 1h sem resposta em recovery (RECOVERY)
 * - F05: User responde após follow-up (retomada)
 * - F06: User responde antes do follow-up (cancelamento implícito)
 * - F07: 12h sem resposta (segundo follow-up mais assertivo)
 * - F08: Follow-up com intelligence context completo
 * - F10: Múltiplos follow-ups sem resposta (escalação)
 *
 * Pré-condições:
 * - Tenant com billing ativo
 * - WhatsApp config (Twilio)
 * - Catálogo e scheduling configurados
 */

import { createLiveTestApp, LiveTestContext } from './helpers/live-test-app-factory';
import {
  sendInboundMessage,
  sendConversationTurns,
  waitForConversation,
  waitForAIResponse,
  getOutboundAIText,
  makePhone,
} from './helpers/webhook-simulator';
import { triggerFollowUp, triggerFollowUpEscalation } from './helpers/follow-up-trigger';
import {
  expectAIResponse,
  expectFollowUpResponse,
  expectHealthyResponse,
} from './helpers/signal-assertions';
import {
  ensureBillingReady,
  ensureWhatsAppReady,
  updateBusinessForNiche,
  seedCommerceFixtures,
  seedSchedulingFixtures,
  saveTenantSnapshot,
  restoreTenantSnapshot,
  NicheConfig,
} from './helpers/niche-seed-fixtures';

const describeLive =
  process.env.RUN_NICHE_LIVE_E2E === 'true' ? describe : describe.skip;

const TENANT_ID =
  process.env.CONVERSATION_FLOW_TENANT_ID ||
  '3251266a-e4e1-4f12-80ae-81314f0b2b9a';

describeLive('Follow-Up Cross-Niche Live Integration', () => {
  jest.setTimeout(360000);

  let ctx: LiveTestContext;
  let snapshot: any;

  beforeAll(async () => {
    ctx = await createLiveTestApp();
    snapshot = await saveTenantSnapshot(ctx.prisma, TENANT_ID);
    await ensureBillingReady(ctx.prisma, TENANT_ID);
    await ensureWhatsAppReady(ctx.prisma, TENANT_ID);
    await seedCommerceFixtures(ctx.app, TENANT_ID);
    await seedSchedulingFixtures(ctx.app, TENANT_ID);
  });

  afterAll(async () => {
    if (ctx?.prisma && snapshot) {
      await restoreTenantSnapshot(ctx.prisma, TENANT_ID, snapshot);
    }
    if (ctx?.app) {
      await ctx.app.close();
    }
  });

  describe('F01: 1h sem resposta em commerce (FOOD)', () => {
    const niche: NicheConfig = {
      businessType: 'FOOD',
      label: 'Restaurantes & Delivery',
      description: 'Delivery com itens, complementos, entrega e pagamento.',
      services: 'Cardapio, pedido, entrega, cupom e pagamento.',
    };

    it('envia follow-up contextual sobre pedido', async () => {
      await updateBusinessForNiche(ctx.app, TENANT_ID, niche);
      const phone = makePhone('FOOD', 'f01-commerce');

      await sendConversationTurns({
        app: ctx.app,
        prisma: ctx.prisma,
        tenantId: TENANT_ID,
        phone,
        turns: ['quero um cafe'],
        baseExternalId: `${phone}-f01`,
      });

      const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
      expect(conv).not.toBeNull();

      await triggerFollowUp({
        eventBus: ctx.inMemoryEventBus,
        tenantId: TENANT_ID,
        conversationId: conv!.conversationId,
        contactId: conv!.contactId,
        interval: '1h',
        intelligence: {
          summary: 'Cliente pediu café, aguardando seleção',
          sentiment: 'POSITIVE',
          tags: ['commerce', 'cafe'],
          interests: ['cafe'],
          nextStep: 'Confirmar item e quantidade',
        },
      });

      const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 2);
      expect(messages).not.toBeNull();

      const aiText = getOutboundAIText(messages!);
      expectFollowUpResponse(aiText, ['cafe', 'pedido', 'carrinho', 'continuar']);
    });
  });

  describe('F02: 1h sem resposta em scheduling (BEAUTY)', () => {
    const niche: NicheConfig = {
      businessType: 'BEAUTY',
      label: 'Beleza & Estetica',
      description: 'Atendimento por horario em beleza e estetica.',
      services: 'Corte, barba, limpeza de pele e procedimentos esteticos.',
    };

    it('envia follow-up contextual sobre agendamento', async () => {
      await updateBusinessForNiche(ctx.app, TENANT_ID, niche);
      const phone = makePhone('BEAUTY', 'f02-scheduling');

      await sendInboundMessage({
        app: ctx.app,
        prisma: ctx.prisma,
        tenantId: TENANT_ID,
        phone,
        text: 'quero agendar um corte de cabelo',
        externalId: `${phone}-f02-0`,
      });

      const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
      expect(conv).not.toBeNull();
      await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);

      await triggerFollowUp({
        eventBus: ctx.inMemoryEventBus,
        tenantId: TENANT_ID,
        conversationId: conv!.conversationId,
        contactId: conv!.contactId,
        interval: '1h',
        intelligence: {
          summary: 'Cliente quer agendar corte de cabelo',
          sentiment: 'NEUTRAL',
          tags: ['scheduling', 'corte'],
          interests: ['corte de cabelo'],
          nextStep: 'Perguntar data e horário',
        },
      });

      const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 2);
      expect(messages).not.toBeNull();

      const aiText = getOutboundAIText(messages!);
      expectFollowUpResponse(aiText, ['corte', 'agendar', 'horario', 'cabelo']);
    });
  });

  describe('F03: 1h sem resposta em consultative (LEGAL)', () => {
    const niche: NicheConfig = {
      businessType: 'LEGAL',
      label: 'Advocacia & Consultores',
      description: 'Advocacia com atendimento consultivo por conversa.',
      services: 'Consulta trabalhista, civel, familiar e orientacao juridica.',
    };

    it('envia follow-up contextual sobre consulta', async () => {
      await updateBusinessForNiche(ctx.app, TENANT_ID, niche);
      const phone = makePhone('LEGAL', 'f03-consultative');

      await sendInboundMessage({
        app: ctx.app,
        prisma: ctx.prisma,
        tenantId: TENANT_ID,
        phone,
        text: 'preciso de orientacao sobre um problema trabalhista',
        externalId: `${phone}-f03-0`,
      });

      const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
      expect(conv).not.toBeNull();
      await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);

      await triggerFollowUp({
        eventBus: ctx.inMemoryEventBus,
        tenantId: TENANT_ID,
        conversationId: conv!.conversationId,
        contactId: conv!.contactId,
        interval: '1h',
        intelligence: {
          summary: 'Cliente precisa de orientação trabalhista',
          sentiment: 'NEUTRAL',
          tags: ['consultative', 'trabalhista'],
          interests: ['orientacao juridica'],
          nextStep: 'Entender detalhes do caso',
        },
      });

      const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 2);
      expect(messages).not.toBeNull();

      const aiText = getOutboundAIText(messages!);
      expectFollowUpResponse(aiText, ['ajudar', 'duvida', 'orientacao', 'trabalhista']);
    });
  });

  describe('F04: 1h sem resposta em recovery (RECOVERY)', () => {
    const niche: NicheConfig = {
      businessType: 'RECOVERY',
      label: 'Recovery',
      description: 'Cobranca, negociação e recuperação de receita.',
      services: 'Cobrança, acordos, promessa de pagamento e parcelamento.',
    };

    it('envia follow-up contextual sobre cobrança', async () => {
      await updateBusinessForNiche(ctx.app, TENANT_ID, niche);
      const phone = makePhone('RECOVERY', 'f04-recovery');

      await sendInboundMessage({
        app: ctx.app,
        prisma: ctx.prisma,
        tenantId: TENANT_ID,
        phone,
        text: 'recebi uma cobranca',
        externalId: `${phone}-f04-0`,
      });

      const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
      expect(conv).not.toBeNull();
      await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);

      await triggerFollowUp({
        eventBus: ctx.inMemoryEventBus,
        tenantId: TENANT_ID,
        conversationId: conv!.conversationId,
        contactId: conv!.contactId,
        interval: '1h',
        intelligence: {
          summary: 'Cliente recebeu cobrança',
          sentiment: 'NEGATIVE',
          tags: ['recovery', 'cobranca'],
          nextStep: 'Oferecer opções de pagamento',
        },
      });

      const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 2);
      expect(messages).not.toBeNull();

      const aiText = getOutboundAIText(messages!);
      expectFollowUpResponse(aiText, ['cobranca', 'pagamento', 'acordo', 'ajudar']);
    });
  });

  describe('F05: user responde após follow-up (retomada)', () => {
    it('conversa retoma do ponto anterior', async () => {
      await updateBusinessForNiche(ctx.app, TENANT_ID, {
        businessType: 'FOOD',
        label: 'Restaurantes',
        description: 'Delivery',
        services: 'Cardapio e pedido',
      });

      const phone = makePhone('FOOD', 'f05-resume');

      await sendInboundMessage({
        app: ctx.app,
        prisma: ctx.prisma,
        tenantId: TENANT_ID,
        phone,
        text: 'quero pedir cafe',
        externalId: `${phone}-f05-0`,
      });

      const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
      expect(conv).not.toBeNull();
      await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);

      // Follow-up disparado
      await triggerFollowUp({
        eventBus: ctx.inMemoryEventBus,
        tenantId: TENANT_ID,
        conversationId: conv!.conversationId,
        contactId: conv!.contactId,
        interval: '1h',
        intelligence: {
          summary: 'Cliente pediu café',
          sentiment: 'NEUTRAL',
          interests: ['cafe'],
        },
      });

      await waitForAIResponse(ctx.prisma, conv!.conversationId, 2);

      // User retoma
      await sendInboundMessage({
        app: ctx.app,
        prisma: ctx.prisma,
        tenantId: TENANT_ID,
        phone,
        text: 'sim, quero continuar o pedido',
        externalId: `${phone}-f05-resume`,
      });

      const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 3);
      expect(messages).not.toBeNull();

      const aiText = getOutboundAIText(messages!);
      expectHealthyResponse(aiText);
    });
  });

  describe('F06: user responde antes do follow-up', () => {
    it('follow-up service recebe cancelamento', async () => {
      await updateBusinessForNiche(ctx.app, TENANT_ID, {
        businessType: 'BEAUTY',
        label: 'Beleza',
        description: 'Salão',
        services: 'Corte e barba',
      });

      const phone = makePhone('BEAUTY', 'f06-cancel');

      await sendInboundMessage({
        app: ctx.app,
        prisma: ctx.prisma,
        tenantId: TENANT_ID,
        phone,
        text: 'quero agendar corte',
        externalId: `${phone}-f06-0`,
      });

      const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
      expect(conv).not.toBeNull();
      await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);

      // User responde antes do follow-up
      await sendInboundMessage({
        app: ctx.app,
        prisma: ctx.prisma,
        tenantId: TENANT_ID,
        phone,
        text: 'pode ser amanha as 14h',
        externalId: `${phone}-f06-1`,
      });

      await waitForAIResponse(ctx.prisma, conv!.conversationId, 2);

      // O follow-up service deve ter sido chamado para cancelar
      expect(ctx.followUpService.cancelFollowUps).toHaveBeenCalled();
    });
  });

  describe('F07: 12h sem resposta (segundo follow-up)', () => {
    it('mensagem mais assertiva no segundo follow-up', async () => {
      await updateBusinessForNiche(ctx.app, TENANT_ID, {
        businessType: 'FOOD',
        label: 'Restaurantes',
        description: 'Delivery',
        services: 'Cardapio e pedido',
      });

      const phone = makePhone('FOOD', 'f07-12h');

      await sendInboundMessage({
        app: ctx.app,
        prisma: ctx.prisma,
        tenantId: TENANT_ID,
        phone,
        text: 'quero pedir bolo',
        externalId: `${phone}-f07-0`,
      });

      const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
      expect(conv).not.toBeNull();
      await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);

      // Primeiro follow-up (1h)
      await triggerFollowUp({
        eventBus: ctx.inMemoryEventBus,
        tenantId: TENANT_ID,
        conversationId: conv!.conversationId,
        contactId: conv!.contactId,
        interval: '1h',
        intelligence: {
          summary: 'Cliente pediu bolo',
          sentiment: 'NEUTRAL',
          interests: ['bolo'],
        },
      });

      await waitForAIResponse(ctx.prisma, conv!.conversationId, 2);

      // Segundo follow-up (12h)
      await triggerFollowUp({
        eventBus: ctx.inMemoryEventBus,
        tenantId: TENANT_ID,
        conversationId: conv!.conversationId,
        contactId: conv!.contactId,
        interval: '12h',
        intelligence: {
          summary: 'Cliente pediu bolo, não respondeu ao primeiro follow-up',
          sentiment: 'NEUTRAL',
          interests: ['bolo'],
          lossReason: 'Inatividade após primeiro contato',
        },
      });

      const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 3);
      expect(messages).not.toBeNull();

      const aiText = getOutboundAIText(messages!);
      expectHealthyResponse(aiText);
    });
  });

  describe('F08: follow-up com intelligence context completo', () => {
    it('usa todos os campos de intelligence na mensagem', async () => {
      await updateBusinessForNiche(ctx.app, TENANT_ID, {
        businessType: 'RETAIL',
        label: 'Varejo',
        description: 'Loja com catalogo',
        services: 'Produtos e pagamento',
      });

      const phone = makePhone('RETAIL', 'f08-intelligence');

      await sendInboundMessage({
        app: ctx.app,
        prisma: ctx.prisma,
        tenantId: TENANT_ID,
        phone,
        text: 'quero comprar camiseta',
        externalId: `${phone}-f08-0`,
      });

      const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
      expect(conv).not.toBeNull();
      await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);

      await triggerFollowUp({
        eventBus: ctx.inMemoryEventBus,
        tenantId: TENANT_ID,
        conversationId: conv!.conversationId,
        contactId: conv!.contactId,
        interval: '1h',
        intelligence: {
          summary: 'Cliente interessado em camiseta dry fit, pediu preço',
          sentiment: 'POSITIVE',
          tags: ['commerce', 'camiseta', 'interesse-alto'],
          interests: ['camiseta dry fit', 'esporte'],
          nextStep: 'Confirmar tamanho e cor',
          lossReason: null,
        },
      });

      const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 2);
      expect(messages).not.toBeNull();

      const aiText = getOutboundAIText(messages!);
      expectFollowUpResponse(aiText, ['camiseta', 'pedido', 'produto', 'compra']);
    });
  });

  describe('F10: múltiplos follow-ups sem resposta (escalação)', () => {
    it('escalação progressiva: 1h → 12h', async () => {
      await updateBusinessForNiche(ctx.app, TENANT_ID, {
        businessType: 'HEALTH',
        label: 'Clinica',
        description: 'Clinica com agenda',
        services: 'Consulta e avaliação',
      });

      const phone = makePhone('HEALTH', 'f10-escalation');

      await sendInboundMessage({
        app: ctx.app,
        prisma: ctx.prisma,
        tenantId: TENANT_ID,
        phone,
        text: 'quero marcar consulta',
        externalId: `${phone}-f10-0`,
      });

      const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
      expect(conv).not.toBeNull();
      await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);

      // 1h follow-up
      await triggerFollowUp({
        eventBus: ctx.inMemoryEventBus,
        tenantId: TENANT_ID,
        conversationId: conv!.conversationId,
        contactId: conv!.contactId,
        interval: '1h',
        intelligence: {
          summary: 'Cliente quer consulta',
          sentiment: 'NEUTRAL',
          tags: ['scheduling'],
          interests: ['consulta'],
        },
      });

      await waitForAIResponse(ctx.prisma, conv!.conversationId, 2);

      // 12h follow-up
      await triggerFollowUp({
        eventBus: ctx.inMemoryEventBus,
        tenantId: TENANT_ID,
        conversationId: conv!.conversationId,
        contactId: conv!.contactId,
        interval: '12h',
        intelligence: {
          summary: 'Cliente quer consulta, não respondeu follow-up de 1h',
          sentiment: 'NEUTRAL',
          tags: ['scheduling'],
          interests: ['consulta'],
          lossReason: 'Sem resposta após 12h',
        },
      });

      const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 3);
      expect(messages).not.toBeNull();

      const aiText = getOutboundAIText(messages!);
      expectHealthyResponse(aiText);
      // Deve ter pelo menos 2 mensagens de follow-up (1h + 12h)
      const aiMessages = messages!.filter(
        (m) => m.direction === 'OUTBOUND' && m.sentBy === 'AI',
      );
      expect(aiMessages.length).toBeGreaterThanOrEqual(3);
    });
  });
});
