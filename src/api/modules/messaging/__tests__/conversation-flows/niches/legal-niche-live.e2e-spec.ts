/**
 * Legal Niche Live E2E Tests
 *
 * Nichos: LEGAL, REALESTATE
 * Estratégia: CONSULTATIVE
 *
 * Cenários cobertos:
 * - Q01: Qualificação de lead
 * - Q02: Pedido de orçamento/proposta
 * - Q03: Pedido de falar com humano
 * - Q04: Dúvida sobre serviços
 * - Q05: Follow-up 1h sem resposta
 * - Q06: Retomada após follow-up
 * - Q08: Múltiplas perguntas em uma mensagem
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

const LEGAL_NICHES: NicheConfig[] = [
  {
    businessType: 'LEGAL',
    label: 'Advocacia & Consultores',
    description: 'Advocacia com atendimento consultivo por conversa.',
    services: 'Consulta trabalhista, civel, familiar, contratos e orientacao juridica.',
  },
  {
    businessType: 'REALESTATE',
    label: 'Imobiliarias',
    description: 'Imobiliaria com atendimento consultivo por conversa.',
    services: 'Venda, locacao, visita, financiamento e documentacao.',
  },
];

describeLive('Legal Niche Live Integration (LEGAL, REALESTATE)', () => {
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

  for (const niche of filterNiches(LEGAL_NICHES)) {
    describe(`${niche.businessType} - ${niche.label}`, () => {
      beforeEach(async () => {
        await updateBusinessForNiche(ctx.app, TENANT_ID, niche);
      });

      it('Q01: qualificação de lead', async () => {
        const phone = makePhone(niche.businessType, 'q01-qualify');
        const question = niche.businessType === 'LEGAL'
          ? 'preciso de um advogado para resolver um problema trabalhista'
          : 'estou procurando um apartamento de 2 quartos na zona sul';

        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: question,
          externalId: `${phone}-q01-0`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['entender', 'necessidade', 'ajudar', 'servico', 'informacao', 'detalhe'],
        });
      });

      it('Q02: pedido de orçamento/proposta', async () => {
        const phone = makePhone(niche.businessType, 'q02-proposal');
        const turns = niche.businessType === 'LEGAL'
          ? [
              'preciso de orientacao juridica',
              'quanto custa uma consulta? quero um orcamento',
            ]
          : [
              'quero visitar um imovel',
              'qual o valor do aluguel e como funciona a visita?',
            ];

        await sendConversationTurns({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          turns,
          baseExternalId: `${phone}-q02`,
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
          mustContainAny: ['orcamento', 'valor', 'proximo passo', 'proposta', 'informacao', 'consulta'],
        });
      });

      it('Q03: pedido de falar com humano', async () => {
        const phone = makePhone(niche.businessType, 'q03-handoff');
        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: 'meu caso e urgente e preciso falar com uma pessoa responsavel agora',
          externalId: `${phone}-q03-0`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['humano', 'responsavel', 'atendente', 'urgente', 'ajudar', 'encaminhar'],
        });
      });

      it('Q04: dúvida sobre serviços', async () => {
        const phone = makePhone(niche.businessType, 'q04-services');
        const question = niche.businessType === 'LEGAL'
          ? 'voces fazem consultoria para empresas?'
          : 'voces trabalham com financiamento imobiliario?';

        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: question,
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
          text: 'preciso de ajuda com um problema',
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
            summary: 'Cliente precisa de ajuda com problema',
            sentiment: 'NEUTRAL',
            tags: ['consultative'],
            nextStep: 'Entender melhor a necessidade',
          },
        });

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 2);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectFollowUpResponse(aiText, ['ajudar', 'duvida', 'problema', 'servico']);
      });

      it('Q06: retomada após follow-up', async () => {
        const phone = makePhone(niche.businessType, 'q06-resume');
        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: 'quero informacoes sobre servicos',
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
          text: 'sim, quero saber mais sobre os valores',
          externalId: `${phone}-q06-resume`,
        });

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 3);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectHealthyResponse(aiText);
      });

      it('Q08: múltiplas perguntas em uma mensagem', async () => {
        const phone = makePhone(niche.businessType, 'q08-multi');
        const question = niche.businessType === 'LEGAL'
          ? 'qual o horario de atendimento? voces fazem consulta online? quanto custa?'
          : 'qual o horario de visita? tem apartamento com vaga? aceita pet?';

        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: question,
          externalId: `${phone}-q08-0`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectHealthyResponse(aiText);
        // Resposta deve ser substancial (respondendo múltiplas perguntas)
        expect(aiText.trim().length).toBeGreaterThan(50);
      });

      it('Q09: mensagem fora do escopo', async () => {
        const phone = makePhone(niche.businessType, 'q09-offscope');
        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: 'qual a previsao do tempo para amanha?',
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
          text: 'qual o horario de funcionamento de voces?',
          externalId: `${phone}-q10-0`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['horario', 'funcionamento', 'segunda', 'sexta', '08', '20', 'sabado'],
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
