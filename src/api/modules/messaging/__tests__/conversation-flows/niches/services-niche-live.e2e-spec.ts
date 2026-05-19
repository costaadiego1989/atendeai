/**
 * Services Niche Live E2E Tests
 *
 * Nichos: AGENCY, AUTOMOTIVE, HOSPITALITY, SIMPLE_SERVICE, RENTAL
 * Estratégia: CONSULTATIVE
 *
 * Cenários cobertos:
 * - Q01: Qualificação de lead
 * - Q02: Pedido de orçamento/proposta
 * - Q03: Pedido de falar com humano
 * - Q04: Dúvida sobre serviços
 * - Q05: Follow-up 1h sem resposta
 * - Q06: Retomada após follow-up
 * - Q09: Mensagem fora do escopo
 * - Q10: Horário de funcionamento
 *
 * Pré-condições:
 * - Tenant com billing ativo
 * - WhatsApp config (Twilio)
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

const SERVICES_NICHES: NicheConfig[] = [
  {
    businessType: 'AGENCY',
    label: 'Agencias',
    description: 'Agencia com atendimento consultivo por conversa.',
    services: 'Marketing, design, social media, campanhas e orcamentos.',
  },
  {
    businessType: 'AUTOMOTIVE',
    label: 'Automotivo',
    description: 'Oficina ou concessionaria com atendimento consultivo.',
    services: 'Revisao, funilaria, pintura, orcamento e agendamento.',
  },
  {
    businessType: 'HOSPITALITY',
    label: 'Hotelaria',
    description: 'Hotel ou pousada com atendimento consultivo.',
    services: 'Reservas, disponibilidade, tarifas e informacoes.',
  },
  {
    businessType: 'SIMPLE_SERVICE',
    label: 'Servico simples',
    description: 'Prestador de servico com atendimento por conversa.',
    services: 'Orcamento, agendamento, duvidas e atendimento.',
  },
  {
    businessType: 'RENTAL',
    label: 'Locacao',
    description: 'Empresa de locacao com atendimento consultivo.',
    services: 'Disponibilidade, valores, reserva e contrato.',
  },
];

describeLive('Services Niche Live Integration (AGENCY, AUTOMOTIVE, HOSPITALITY, SIMPLE_SERVICE, RENTAL)', () => {
  jest.setTimeout(360000);

  let ctx: LiveTestContext;
  let snapshot: any;

  beforeAll(async () => {
    ctx = await createLiveTestApp();
    snapshot = await saveTenantSnapshot(ctx.prisma, TENANT_ID);
    await ensureBillingReady(ctx.prisma, TENANT_ID);
    await ensureWhatsAppReady(ctx.prisma, TENANT_ID);
  });

  afterAll(async () => {
    if (ctx?.prisma && snapshot) {
      await restoreTenantSnapshot(ctx.prisma, TENANT_ID, snapshot);
    }
    if (ctx?.app) {
      await ctx.app.close();
    }
  });

  for (const niche of filterNiches(SERVICES_NICHES)) {
    describe(`${niche.businessType} - ${niche.label}`, () => {
      beforeEach(async () => {
        await updateBusinessForNiche(ctx.app, TENANT_ID, niche);
      });

      it('Q01: qualificação de lead', async () => {
        const phone = makePhone(niche.businessType, 'q01-qualify');
        const questions: Record<string, string> = {
          AGENCY: 'preciso de uma agencia para cuidar do marketing da minha empresa',
          AUTOMOTIVE: 'meu carro esta com um barulho estranho, voces fazem diagnostico?',
          HOSPITALITY: 'quero reservar um quarto para o proximo fim de semana',
          SIMPLE_SERVICE: 'preciso de um orcamento para o servico de voces',
          RENTAL: 'quero alugar um equipamento para um evento',
        };

        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: questions[niche.businessType],
          externalId: `${phone}-q01-0`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['entender', 'ajudar', 'servico', 'informacao', 'detalhe', 'necessidade'],
        });
      });

      it('Q02: pedido de orçamento', async () => {
        const phone = makePhone(niche.businessType, 'q02-proposal');
        const questions: Record<string, string[]> = {
          AGENCY: ['preciso de marketing digital', 'quanto custa o pacote mensal?'],
          AUTOMOTIVE: ['preciso de revisao completa', 'qual o valor e prazo?'],
          HOSPITALITY: ['quero reservar para 3 noites', 'qual a tarifa?'],
          SIMPLE_SERVICE: ['preciso do servico', 'quanto custa?'],
          RENTAL: ['quero alugar por 5 dias', 'qual o valor?'],
        };

        await sendConversationTurns({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          turns: questions[niche.businessType],
          baseExternalId: `${phone}-q02`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 2);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['valor', 'orcamento', 'proposta', 'informacao', 'proximo'],
        });
      });

      it('Q03: pedido de falar com humano', async () => {
        const phone = makePhone(niche.businessType, 'q03-handoff');
        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: 'quero falar com um atendente humano por favor',
          externalId: `${phone}-q03-0`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['humano', 'atendente', 'responsavel', 'encaminhar', 'ajudar'],
        });
      });

      it('Q04: dúvida sobre serviços', async () => {
        const phone = makePhone(niche.businessType, 'q04-services');
        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: 'quais servicos voces oferecem?',
          externalId: `${phone}-q04-0`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectHealthyResponse(aiText);
      });

      it('Q05: follow-up 1h sem resposta', async () => {
        const phone = makePhone(niche.businessType, 'q05-followup');
        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: 'quero saber mais',
          externalId: `${phone}-q05-0`,
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
            summary: 'Cliente quer saber mais sobre serviços',
            sentiment: 'NEUTRAL',
            tags: ['consultative'],
            nextStep: 'Entender necessidade',
          },
        });

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 2);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectFollowUpResponse(aiText, ['ajudar', 'servico', 'duvida', 'informacao']);
      });

      it('Q06: retomada após follow-up', async () => {
        const phone = makePhone(niche.businessType, 'q06-resume');
        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: 'oi, quero informacoes',
          externalId: `${phone}-q06-0`,
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
            summary: 'Cliente quer informações',
            sentiment: 'NEUTRAL',
          },
        });

        await waitForAIResponse(ctx.prisma, conv!.conversationId, 2);

        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: 'sim, pode me passar os detalhes',
          externalId: `${phone}-q06-resume`,
        });

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 3);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectHealthyResponse(aiText);
      });

      it('Q09: mensagem fora do escopo', async () => {
        const phone = makePhone(niche.businessType, 'q09-offscope');
        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: 'me conta uma piada',
          externalId: `${phone}-q09-0`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectHealthyResponse(aiText);
      });

      it('Q10: horário de funcionamento', async () => {
        const phone = makePhone(niche.businessType, 'q10-hours');
        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: 'qual horario de funcionamento?',
          externalId: `${phone}-q10-0`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['horario', 'funcionamento', 'segunda', 'sexta', '08', '20'],
        });
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
