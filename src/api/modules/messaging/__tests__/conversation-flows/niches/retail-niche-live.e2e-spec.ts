/**
 * Retail Niche Live E2E Tests
 *
 * Nichos: RETAIL, ECOMMERCE
 * Estratégia: COMMERCE
 *
 * Cenários cobertos:
 * - C01: Consulta de preço simples
 * - C02: Seleção de item por número
 * - C11: Aplicar cupom válido
 * - C13: Fluxo completo delivery com cupom
 * - C14: Fluxo completo retirada
 * - C15: Abandono de carrinho
 * - C16: Retomada após follow-up
 * - C18: Consulta sem match no catálogo
 * - C19: Múltiplos produtos no carrinho
 *
 * Pré-condições:
 * - Tenant com billing ativo
 * - WhatsApp config (Twilio)
 * - Catálogo com produtos (camiseta, café, arroz)
 * - Shipping policy configurada
 * - Cupom de desconto ativo
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
import { triggerFollowUp } from './helpers/follow-up-trigger';
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
  saveTenantSnapshot,
  restoreTenantSnapshot,
  NicheConfig,
} from './helpers/niche-seed-fixtures';

const describeLive =
  process.env.RUN_NICHE_LIVE_E2E === 'true' ? describe : describe.skip;

const TENANT_ID =
  process.env.CONVERSATION_FLOW_TENANT_ID ||
  '3251266a-e4e1-4f12-80ae-81314f0b2b9a';

const RETAIL_NICHES: NicheConfig[] = [
  {
    businessType: 'RETAIL',
    label: 'Varejo',
    description: 'Loja com catalogo, estoque e retirada ou entrega.',
    services: 'Produtos, estoque, carrinho, cupom e pagamento por link.',
  },
  {
    businessType: 'ECOMMERCE',
    label: 'E-commerce',
    description: 'Venda online com checkout conversacional.',
    services: 'Catalogo, carrinho, cupom, frete, pagamento e abandono.',
  },
];

describeLive('Retail Niche Live Integration (RETAIL, ECOMMERCE)', () => {
  jest.setTimeout(360000);

  let ctx: LiveTestContext;
  let snapshot: any;
  let couponCode: string;

  beforeAll(async () => {
    ctx = await createLiveTestApp();
    snapshot = await saveTenantSnapshot(ctx.prisma, TENANT_ID);
    await ensureBillingReady(ctx.prisma, TENANT_ID);
    await ensureWhatsAppReady(ctx.prisma, TENANT_ID);
    const commerce = await seedCommerceFixtures(ctx.app, TENANT_ID);
    couponCode = commerce.couponCode;
  });

  afterAll(async () => {
    if (ctx?.prisma && snapshot) {
      await restoreTenantSnapshot(ctx.prisma, TENANT_ID, snapshot);
    }
    if (ctx?.app) {
      await ctx.app.close();
    }
  });

  for (const niche of filterNiches(RETAIL_NICHES)) {
    describe(`${niche.businessType} - ${niche.label}`, () => {
      beforeEach(async () => {
        await updateBusinessForNiche(ctx.app, TENANT_ID, niche);
      });

      it('C01: consulta de preço de produto', async () => {
        const phone = makePhone(niche.businessType, 'c01-price');
        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: 'quanto custa a camiseta dry fit?',
          externalId: `${phone}-c01-0`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['camiseta', 'dry fit', 'preco', 'valor', '59', 'disponivel'],
        });
      });

      it('C02: seleção de item do catálogo', async () => {
        const phone = makePhone(niche.businessType, 'c02-select');
        await sendConversationTurns({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          turns: ['quero comprar camiseta dry fit', '1'],
          baseExternalId: `${phone}-c02`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 2);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['camiseta', 'quantidade', 'selecion', 'escolh', 'adicion', 'dry fit'],
        });
      });

      it('C11: aplicar cupom válido no carrinho', async () => {
        const phone = makePhone(niche.businessType, 'c11-coupon');
        const turns = [
          'quero a camiseta dry fit',
          '1',
          '1',
          'nao, finalizar',
          'retirada',
          'sem observacao',
          `tenho cupom ${couponCode}`,
        ];

        await sendConversationTurns({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          turns,
          baseExternalId: `${phone}-c11`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(
          ctx.prisma,
          conv!.conversationId,
          turns.length,
        );
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['cupom', 'desconto', 'aplicado', '10%', 'total'],
        });
      });

      it('C13: fluxo completo delivery com cupom', async () => {
        const phone = makePhone(niche.businessType, 'c13-delivery');
        const turns = [
          'quero a camiseta dry fit',
          '1',
          '1',
          'nao, so isso',
          'entrega',
          'Rua das Flores 100, Copacabana',
          'sem observacao',
          `cupom ${couponCode}`,
          'pode mandar o link',
        ];

        await sendConversationTurns({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          turns,
          baseExternalId: `${phone}-c13`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(
          ctx.prisma,
          conv!.conversationId,
          turns.length,
        );
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['pagamento', 'pix', 'link', 'pedido', 'entrega', 'total'],
        });

        expect(ctx.queueTraces.length).toBeGreaterThan(0);
      });

      it('C19: múltiplos produtos no carrinho', async () => {
        const phone = makePhone(niche.businessType, 'c19-multi');
        const turns = [
          'quero camiseta dry fit',
          '1',
          '2',
          'sim, quero mais',
          'cafe 500g',
          '1',
          '1',
          'nao, finalizar',
          'retirada',
          'sem obs',
          'confirmar',
        ];

        await sendConversationTurns({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          turns,
          baseExternalId: `${phone}-c19`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(
          ctx.prisma,
          conv!.conversationId,
          turns.length,
        );
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['camiseta', 'cafe', 'total', 'pedido', 'pagamento'],
        });
      });

      it('C15: abandono de carrinho por inatividade', async () => {
        const phone = makePhone(niche.businessType, 'c15-abandon');
        await sendConversationTurns({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          turns: ['quero camiseta', '1', '1'],
          baseExternalId: `${phone}-c15`,
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
            summary: 'Cliente selecionou camiseta dry fit',
            sentiment: 'NEUTRAL',
            tags: ['commerce', 'camiseta'],
            interests: ['camiseta dry fit'],
            nextStep: 'Confirmar se deseja continuar o pedido',
          },
        });

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 4);
        expect(messages).not.toBeNull();

        const lastAI = getOutboundAIText(messages!);
        expectFollowUpResponse(lastAI, ['camiseta', 'pedido', 'carrinho', 'produto']);
      });

      it('C14: fluxo completo retirada (pickup)', async () => {
        const phone = makePhone(niche.businessType, 'c14-pickup');
        const turns = [
          'quero camiseta dry fit',
          '1',
          '1',
          'nao, finalizar',
          'retirada',
          'sem observacao',
          'confirmar pedido',
        ];

        await sendConversationTurns({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          turns,
          baseExternalId: `${phone}-c14`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(
          ctx.prisma,
          conv!.conversationId,
          turns.length,
        );
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['retirada', 'pagamento', 'pedido', 'total', 'pix', 'link'],
        });
      });

      it('C16: retomada após follow-up', async () => {
        const phone = makePhone(niche.businessType, 'c16-resume');
        await sendConversationTurns({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          turns: ['quero camiseta', '1', '1'],
          baseExternalId: `${phone}-c16`,
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
            summary: 'Cliente selecionou camiseta',
            sentiment: 'NEUTRAL',
            interests: ['camiseta'],
          },
        });

        await waitForAIResponse(ctx.prisma, conv!.conversationId, 4);

        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: 'sim, quero continuar meu pedido',
          externalId: `${phone}-c16-resume`,
        });

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 5);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectHealthyResponse(aiText);
      });

      it('C18: consulta sem match no catálogo', async () => {
        const phone = makePhone(niche.businessType, 'c18-no-match');
        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: 'voces vendem geladeira?',
          externalId: `${phone}-c18-0`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectHealthyResponse(aiText);
      });
    });
  }
});

function filterNiches(niches: NicheConfig[]): NicheConfig[] {
  const filter = process.env.NICHE_FILTER;
  if (!filter) return niches;
  const allowed = filter.split(',').map((v) => v.trim().toUpperCase());
  return niches.filter((n) => allowed.includes(n.businessType));
}
