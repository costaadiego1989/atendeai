/**
 * Supermarket Niche Live E2E Tests
 *
 * Nichos: SUPERMARKET, MARKET, GROCERY
 * Estratégia: COMMERCE
 *
 * Cenários cobertos:
 * - C01: Consulta de preço (arroz, leite)
 * - C04: Adicionar mais itens (loop)
 * - C06: Escolher entrega
 * - C07: Escolher retirada
 * - C13: Fluxo completo delivery
 * - C14: Fluxo completo retirada
 * - C15: Abandono de carrinho
 * - C19: Múltiplos produtos (lista de compras)
 *
 * Pré-condições:
 * - Catálogo com produtos de supermercado (arroz, café)
 * - Shipping policy configurada
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

const SUPERMARKET_NICHES: NicheConfig[] = [
  {
    businessType: 'SUPERMARKET',
    label: 'Supermercado',
    description: 'Compra assistida de itens de mercado.',
    services: 'Produtos do dia a dia, estoque, entrega, cupom e checkout.',
  },
  {
    businessType: 'MARKET',
    label: 'Mercado',
    description: 'Mercado de bairro com venda pelo WhatsApp.',
    services: 'Mercearia, bebidas, limpeza, entrega e retirada.',
  },
  {
    businessType: 'GROCERY',
    label: 'Mercearia',
    description: 'Catalogo enxuto com carrinho assistido.',
    services: 'Itens basicos, estoque, entrega e pagamento.',
  },
];

describeLive('Supermarket Niche Live Integration (SUPERMARKET, MARKET, GROCERY)', () => {
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

  for (const niche of filterNiches(SUPERMARKET_NICHES)) {
    describe(`${niche.businessType} - ${niche.label}`, () => {
      beforeEach(async () => {
        await updateBusinessForNiche(ctx.app, TENANT_ID, niche);
      });

      it('C01: consulta de preço de item de mercado', async () => {
        const phone = makePhone(niche.businessType, 'c01-price');
        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: 'quanto custa o arroz 5kg?',
          externalId: `${phone}-c01-0`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['arroz', 'preco', 'valor', '24', 'disponivel', '5kg'],
        });
      });

      it('C04: adicionar mais itens (lista de compras)', async () => {
        const phone = makePhone(niche.businessType, 'c04-add-more');
        await sendConversationTurns({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          turns: ['quero arroz 5kg', '1', '2', 'sim, quero cafe 500g tambem'],
          baseExternalId: `${phone}-c04`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 4);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['cafe', 'adicion', 'item', 'pedido', 'mais', 'lista'],
        });
      });

      it('C06: escolha de delivery com endereço', async () => {
        const phone = makePhone(niche.businessType, 'c06-delivery');
        await sendConversationTurns({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          turns: ['quero arroz 5kg', '1', '1', 'nao', 'entrega', 'Rua Centro 100, Centro'],
          baseExternalId: `${phone}-c06`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 6);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['endereco', 'entrega', 'taxa', 'frete', 'pagamento', 'confirmar', 'total'],
        });
      });

      it('C07: escolha de retirada (pickup)', async () => {
        const phone = makePhone(niche.businessType, 'c07-pickup-choice');
        await sendConversationTurns({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          turns: ['quero arroz 5kg', '1', '1', 'nao', 'retirada'],
          baseExternalId: `${phone}-c07`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 5);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['retirada', 'observacao', 'pagamento', 'confirmar', 'pedido'],
        });
      });

      it('C13: fluxo completo delivery de mercado', async () => {
        const phone = makePhone(niche.businessType, 'c13-delivery');
        const turns = [
          'quero arroz 5kg',
          '1',
          '2',
          'nao, so isso',
          'entrega',
          'Rua Botafogo 200, Botafogo',
          'sem observacao',
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
      });

      it('C14: fluxo completo retirada', async () => {
        const phone = makePhone(niche.businessType, 'c14-pickup');
        const turns = [
          'quero cafe 500g',
          '1',
          '1',
          'nao',
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
          mustContainAny: ['retirada', 'pagamento', 'pedido', 'total', 'pix'],
        });
      });

      it('C19: múltiplos produtos (lista de compras)', async () => {
        const phone = makePhone(niche.businessType, 'c19-list');
        const turns = [
          'quero arroz 5kg',
          '1',
          '1',
          'sim, quero mais',
          'cafe 500g',
          '1',
          '2',
          'nao, finalizar',
          'entrega',
          'Rua Centro 50, Centro',
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
          mustContainAny: ['arroz', 'cafe', 'total', 'pedido', 'pagamento'],
        });
      });

      it('C15: abandono de carrinho por inatividade', async () => {
        const phone = makePhone(niche.businessType, 'c15-abandon');
        await sendConversationTurns({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          turns: ['quero arroz', '1', '1'],
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
            summary: 'Cliente pediu arroz 5kg',
            sentiment: 'NEUTRAL',
            tags: ['commerce', 'arroz'],
            interests: ['arroz'],
            nextStep: 'Confirmar se deseja continuar',
          },
        });

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 4);
        expect(messages).not.toBeNull();

        const lastAI = getOutboundAIText(messages!);
        expectFollowUpResponse(lastAI, ['arroz', 'pedido', 'carrinho', 'compra']);
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
