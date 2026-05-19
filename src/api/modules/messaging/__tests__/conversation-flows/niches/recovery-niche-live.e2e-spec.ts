/**
 * Recovery Niche Live E2E Tests
 *
 * Nicho: RECOVERY
 * Estratégia: RECOVERY
 *
 * Cenários cobertos:
 * - R01: Cliente pede explicação da cobrança
 * - R02: Promessa de pagamento
 * - R03: Pedido de parcelamento
 * - R04: Contestação de dívida (escala para humano)
 * - R06: Follow-up 1h sem resposta
 * - R07: Retomada após follow-up
 * - R08: Cliente agressivo/irritado (safety gate)
 * - R09: Múltiplas cobranças
 * - R10: Acordo fechado com link de pagamento
 *
 * Pré-condições:
 * - Tenant com billing ativo
 * - WhatsApp config (Twilio)
 * - businessType = RECOVERY
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
  saveTenantSnapshot,
  restoreTenantSnapshot,
  NicheConfig,
} from './helpers/niche-seed-fixtures';

const describeLive =
  process.env.RUN_NICHE_LIVE_E2E === 'true' ? describe : describe.skip;

const TENANT_ID =
  process.env.CONVERSATION_FLOW_TENANT_ID ||
  '3251266a-e4e1-4f12-80ae-81314f0b2b9a';

const RECOVERY_NICHE: NicheConfig = {
  businessType: 'RECOVERY',
  label: 'Recovery',
  description: 'Cobranca, negociação e recuperação de receita.',
  services: 'Cobrança, acordos, promessa de pagamento e parcelamento.',
};

describeLive('Recovery Niche Live Integration (RECOVERY)', () => {
  jest.setTimeout(360000);

  let ctx: LiveTestContext;
  let snapshot: any;

  beforeAll(async () => {
    ctx = await createLiveTestApp();
    snapshot = await saveTenantSnapshot(ctx.prisma, TENANT_ID);
    await ensureBillingReady(ctx.prisma, TENANT_ID);
    await ensureWhatsAppReady(ctx.prisma, TENANT_ID);
    await updateBusinessForNiche(ctx.app, TENANT_ID, RECOVERY_NICHE);
  });

  afterAll(async () => {
    if (ctx?.prisma && snapshot) {
      await restoreTenantSnapshot(ctx.prisma, TENANT_ID, snapshot);
    }
    if (ctx?.app) {
      await ctx.app.close();
    }
  });

  describe('RECOVERY - Cobrança & Negociação', () => {
    it('R01: cliente pede explicação da cobrança', async () => {
      const phone = makePhone('RECOVERY', 'r01-explain');
      await sendInboundMessage({
        app: ctx.app,
        prisma: ctx.prisma,
        tenantId: TENANT_ID,
        phone,
        text: 'recebi uma cobranca e nao entendi o valor em aberto',
        externalId: `${phone}-r01-0`,
      });

      const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
      expect(conv).not.toBeNull();

      const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);
      expect(messages).not.toBeNull();

      const aiText = getOutboundAIText(messages!);
      expectAIResponse(aiText, {
        mustContainAny: ['cobranca', 'valor', 'pagamento', 'entender', 'ajudar', 'pendencia'],
      });
    });

    it('R02: promessa de pagamento', async () => {
      const phone = makePhone('RECOVERY', 'r02-promise');
      await sendInboundMessage({
        app: ctx.app,
        prisma: ctx.prisma,
        tenantId: TENANT_ID,
        phone,
        text: 'consigo pagar na sexta-feira, voces conseguem aguardar?',
        externalId: `${phone}-r02-0`,
      });

      const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
      expect(conv).not.toBeNull();

      const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);
      expect(messages).not.toBeNull();

      const aiText = getOutboundAIText(messages!);
      expectAIResponse(aiText, {
        mustContainAny: ['sexta', 'pagamento', 'combinado', 'aguardar', 'prazo', 'registr'],
      });
    });

    it('R03: pedido de parcelamento', async () => {
      const phone = makePhone('RECOVERY', 'r03-installment');
      await sendInboundMessage({
        app: ctx.app,
        prisma: ctx.prisma,
        tenantId: TENANT_ID,
        phone,
        text: 'nao consigo pagar tudo de uma vez, tem como parcelar?',
        externalId: `${phone}-r03-0`,
      });

      const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
      expect(conv).not.toBeNull();

      const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);
      expect(messages).not.toBeNull();

      const aiText = getOutboundAIText(messages!);
      expectAIResponse(aiText, {
        mustContainAny: ['parcelar', 'parcela', 'negociar', 'opcao', 'pagamento', 'acordo'],
      });
    });

    it('R04: contestação de dívida (escala para humano)', async () => {
      const phone = makePhone('RECOVERY', 'r04-contest');
      await sendInboundMessage({
        app: ctx.app,
        prisma: ctx.prisma,
        tenantId: TENANT_ID,
        phone,
        text: 'essa cobranca esta errada, eu ja paguei isso! quero falar com um responsavel',
        externalId: `${phone}-r04-0`,
      });

      const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
      expect(conv).not.toBeNull();

      const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);
      expect(messages).not.toBeNull();

      const aiText = getOutboundAIText(messages!);
      expectAIResponse(aiText, {
        mustContainAny: ['humano', 'responsavel', 'atendente', 'verificar', 'entender', 'ajudar'],
      });
    });

    it('R06: follow-up 1h sem resposta', async () => {
      const phone = makePhone('RECOVERY', 'r06-followup');
      await sendInboundMessage({
        app: ctx.app,
        prisma: ctx.prisma,
        tenantId: TENANT_ID,
        phone,
        text: 'recebi cobranca de R$500',
        externalId: `${phone}-r06-0`,
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
          summary: 'Cliente recebeu cobrança de R$500',
          sentiment: 'NEGATIVE',
          tags: ['recovery', 'cobranca'],
          interests: ['pagamento'],
          nextStep: 'Oferecer opções de pagamento',
        },
      });

      const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 2);
      expect(messages).not.toBeNull();

      const aiText = getOutboundAIText(messages!);
      expectFollowUpResponse(aiText, ['cobranca', 'pagamento', 'acordo', 'valor', 'pendencia']);
    });

    it('R07: retomada após follow-up', async () => {
      const phone = makePhone('RECOVERY', 'r07-resume');
      await sendInboundMessage({
        app: ctx.app,
        prisma: ctx.prisma,
        tenantId: TENANT_ID,
        phone,
        text: 'recebi cobranca',
        externalId: `${phone}-r07-0`,
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
          sentiment: 'NEUTRAL',
          tags: ['recovery'],
          nextStep: 'Oferecer negociação',
        },
      });

      await waitForAIResponse(ctx.prisma, conv!.conversationId, 2);

      await sendInboundMessage({
        app: ctx.app,
        prisma: ctx.prisma,
        tenantId: TENANT_ID,
        phone,
        text: 'ok, quero negociar o pagamento',
        externalId: `${phone}-r07-resume`,
      });

      const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 3);
      expect(messages).not.toBeNull();

      const aiText = getOutboundAIText(messages!);
      expectAIResponse(aiText, {
        mustContainAny: ['negociar', 'pagamento', 'opcao', 'parcelar', 'acordo', 'valor'],
      });
    });

    it('R08: cliente agressivo mantém resposta profissional', async () => {
      const phone = makePhone('RECOVERY', 'r08-aggressive');
      await sendInboundMessage({
        app: ctx.app,
        prisma: ctx.prisma,
        tenantId: TENANT_ID,
        phone,
        text: 'voces sao uns ladroes! nao vou pagar nada! me deixem em paz!',
        externalId: `${phone}-r08-0`,
      });

      const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
      expect(conv).not.toBeNull();

      const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);
      expect(messages).not.toBeNull();

      const aiText = getOutboundAIText(messages!);
      expectHealthyResponse(aiText);
      // Deve manter tom profissional, não retribuir agressividade
      expectAIResponse(aiText, {
        mustContainAny: ['entendo', 'ajudar', 'resolver', 'humano', 'atendente', 'compreendo'],
        mustNotContain: ['ladrao', 'sua culpa', 'culpa sua', 'obrigado a pagar'],
      });
    });

    it('R09: múltiplas cobranças', async () => {
      const phone = makePhone('RECOVERY', 'r09-multiple');
      await sendInboundMessage({
        app: ctx.app,
        prisma: ctx.prisma,
        tenantId: TENANT_ID,
        phone,
        text: 'recebi varias cobranças, quero entender todas as pendencias',
        externalId: `${phone}-r09-0`,
      });

      const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
      expect(conv).not.toBeNull();

      const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);
      expect(messages).not.toBeNull();

      const aiText = getOutboundAIText(messages!);
      expectAIResponse(aiText, {
        mustContainAny: ['cobranca', 'pendencia', 'valor', 'ajudar', 'verificar', 'detalhe'],
      });
    });

    it('R10: acordo com link de pagamento', async () => {
      const phone = makePhone('RECOVERY', 'r10-agreement');
      const turns = [
        'recebi cobranca de R$300',
        'quero pagar, pode mandar o link',
      ];

      await sendConversationTurns({
        app: ctx.app,
        prisma: ctx.prisma,
        tenantId: TENANT_ID,
        phone,
        turns,
        baseExternalId: `${phone}-r10`,
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
        mustContainAny: ['pagamento', 'link', 'pix', 'valor', 'acordo'],
      });
    });
  });
});
