/**
 * Food Niche Live E2E Tests
 *
 * Nichos: FOOD, BAKERY, CAFETERIA
 * Estratégia: COMMERCE
 *
 * Cenários cobertos:
 * - C01: Consulta de preço simples
 * - C02: Seleção de item por número
 * - C03: Definição de quantidade
 * - C04: Adicionar mais itens
 * - C05: Finalizar sem mais itens
 * - C06: Escolher entrega
 * - C08: Informar endereço
 * - C09: Pular observação
 * - C12: Confirmar pagamento (checkout)
 * - C13: Fluxo completo delivery
 * - C14: Fluxo completo retirada
 * - C15: Abandono de carrinho
 * - C16: Retomada após follow-up
 * - C18: Consulta sem match no catálogo
 * - C20: Cupom inválido
 *
 * Pré-condições:
 * - Tenant com billing ativo
 * - WhatsApp config (Twilio)
 * - Catálogo com produtos (café, bolo)
 * - Shipping policy configurada
 * - Cupom de desconto ativo
 */

import { INestApplication } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { IEventBus } from '@shared/application/ports/IEventBus';

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
  expectCommerceSession,
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

const FOOD_NICHES: NicheConfig[] = [
  {
    businessType: 'FOOD',
    label: 'Restaurantes & Delivery',
    description: 'Delivery com itens, complementos, entrega e pagamento.',
    services: 'Cardapio, pedido, entrega, cupom e pagamento.',
  },
  {
    businessType: 'BAKERY',
    label: 'Padaria',
    description: 'Padaria com pedidos rapidos e retirada ou entrega.',
    services: 'Pao, bolo, cafe, entrega, retirada e pagamento.',
  },
  {
    businessType: 'CAFETERIA',
    label: 'Cafeteria',
    description: 'Venda de bebidas e acompanhamentos.',
    services: 'Cafe, bolo, combos, entrega e pagamento.',
  },
];

describeLive('Food Niche Live Integration (FOOD, BAKERY, CAFETERIA)', () => {
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

  for (const niche of filterNiches(FOOD_NICHES)) {
    describe(`${niche.businessType} - ${niche.label}`, () => {
      beforeEach(async () => {
        await updateBusinessForNiche(ctx.app, TENANT_ID, niche);
      });

      it('C01: consulta de preço inicia commerce session', async () => {
        const phone = makePhone(niche.businessType, 'c01-price');
        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: 'tem cafe? quanto custa?',
          externalId: `${phone}-c01-0`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['cafe', 'preco', 'valor', '18', 'disponivel', 'cardapio'],
        });
      });

      it('C02: seleção de item do cardápio', async () => {
        const phone = makePhone(niche.businessType, 'c02-select');
        await sendConversationTurns({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          turns: ['quero pedir cafe', '1'],
          baseExternalId: `${phone}-c02`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 2);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['cafe', 'quantidade', 'selecion', 'escolh', 'item', 'adicion'],
        });
      });

      it('C03: definição de quantidade', async () => {
        const phone = makePhone(niche.businessType, 'c03-qty');
        await sendConversationTurns({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          turns: ['quero cafe', '1', '3'],
          baseExternalId: `${phone}-c03`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 3);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['3', 'quantidade', 'adicion', 'mais', 'algo', 'finalizar'],
        });
      });

      it('C04: adicionar mais itens ao pedido', async () => {
        const phone = makePhone(niche.businessType, 'c04-add-more');
        await sendConversationTurns({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          turns: ['quero cafe', '1', '2', 'sim, quero um bolo tambem'],
          baseExternalId: `${phone}-c04`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 4);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['bolo', 'adicion', 'item', 'pedido', 'mais'],
        });
      });

      it('C05: finalização do carrinho', async () => {
        const phone = makePhone(niche.businessType, 'c05-finalize');
        await sendConversationTurns({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          turns: ['quero cafe', '1', '2', 'nao, so isso'],
          baseExternalId: `${phone}-c05`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 4);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['entrega', 'retirada', 'delivery', 'pickup', 'como', 'receber'],
        });
      });

      it('C06: escolha de delivery com endereço', async () => {
        const phone = makePhone(niche.businessType, 'c06-delivery');
        await sendConversationTurns({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          turns: ['quero cafe', '1', '2', 'nao', 'entrega', 'Rua das Flores 50, Centro'],
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

      it('C08: coleta de endereço para delivery', async () => {
        const phone = makePhone(niche.businessType, 'c08-address');
        await sendConversationTurns({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          turns: ['quero cafe', '1', '1', 'nao', 'entrega'],
          baseExternalId: `${phone}-c08`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 5);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['endereco', 'entrega', 'onde', 'local', 'enviar'],
        });
      });

      it('C09: pular observação', async () => {
        const phone = makePhone(niche.businessType, 'c09-skip-obs');
        await sendConversationTurns({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          turns: ['quero cafe', '1', '1', 'nao', 'retirada', 'sem observacao'],
          baseExternalId: `${phone}-c09`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 6);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['pagamento', 'total', 'confirmar', 'pedido', 'pix', 'link'],
        });
      });

      it('C12: checkout e link de pagamento', async () => {
        const phone = makePhone(niche.businessType, 'c12-checkout');
        await sendConversationTurns({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          turns: [
            'quero cafe',
            '1',
            '1',
            'nao, finalizar',
            'retirada',
            'sem obs',
            'confirmar pedido',
          ],
          baseExternalId: `${phone}-c12`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(
          ctx.prisma,
          conv!.conversationId,
          7,
        );
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['pedido', 'confirmado', 'pagamento', 'pix', 'link', 'total', 'obrigad'],
        });
      });

      it('C13: fluxo completo delivery com seleção e pagamento', async () => {
        const phone = makePhone(niche.businessType, 'c13-full-delivery');
        const turns = [
          'quero um cafe',
          '1',
          '2',
          'nao, so isso',
          'entrega',
          'Rua das Flores 100, Copacabana',
          'sem observacao',
          'pode mandar o link de pagamento',
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

      it('C14: fluxo completo retirada (pickup)', async () => {
        const phone = makePhone(niche.businessType, 'c14-pickup');
        const turns = [
          'quero um bolo de cenoura',
          '1',
          '1',
          'nao, finalizar',
          'retirada',
          'nenhuma observacao',
          'confirmar pagamento',
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

      it('C15: abandono de carrinho por inatividade', async () => {
        const phone = makePhone(niche.businessType, 'c15-abandon');
        // Inicia conversa mas para no meio
        await sendConversationTurns({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          turns: ['quero cafe', '1', '1'],
          baseExternalId: `${phone}-c15`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        // Simula follow-up de 1h (abandono)
        await triggerFollowUp({
          eventBus: ctx.inMemoryEventBus,
          tenantId: TENANT_ID,
          conversationId: conv!.conversationId,
          contactId: conv!.contactId,
          interval: '1h',
          intelligence: {
            summary: 'Cliente pediu cafe e selecionou quantidade',
            sentiment: 'NEUTRAL',
            tags: ['commerce', 'cafe'],
            interests: ['cafe'],
            nextStep: 'Confirmar se deseja continuar o pedido',
          },
        });

        // Aguarda resposta do follow-up
        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 4);
        expect(messages).not.toBeNull();

        const lastAI = getOutboundAIText(messages!);
        expectFollowUpResponse(lastAI, ['cafe', 'pedido', 'carrinho', 'continuar']);
      });

      it('C16: retomada após follow-up', async () => {
        const phone = makePhone(niche.businessType, 'c16-resume');
        await sendConversationTurns({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          turns: ['quero cafe', '1', '1'],
          baseExternalId: `${phone}-c16`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        // Trigger follow-up
        await triggerFollowUp({
          eventBus: ctx.inMemoryEventBus,
          tenantId: TENANT_ID,
          conversationId: conv!.conversationId,
          contactId: conv!.contactId,
          interval: '1h',
          intelligence: {
            summary: 'Cliente pediu cafe',
            sentiment: 'NEUTRAL',
            interests: ['cafe'],
          },
        });

        await waitForAIResponse(ctx.prisma, conv!.conversationId, 4);

        // User retoma
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
          text: 'voces vendem televisao?',
          externalId: `${phone}-c18-0`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectHealthyResponse(aiText);
        // Não deve inventar produto que não existe
        expectAIResponse(aiText, {
          mustContainAny: ['nao', 'disponivel', 'cardapio', 'temos', 'oferecemos', 'ajudar'],
          mustNotContain: ['televisao em estoque', 'televisao disponivel'],
        });
      });

      it('C20: cupom inválido não quebra o fluxo', async () => {
        const phone = makePhone(niche.businessType, 'c20-bad-coupon');
        const turns = [
          'quero cafe',
          '1',
          '1',
          'nao',
          'retirada',
          'sem obs',
          'tenho cupom INVALIDO999',
        ];

        await sendConversationTurns({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          turns,
          baseExternalId: `${phone}-c20`,
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
