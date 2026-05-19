/**
 * Education Niche Live E2E Tests
 *
 * Nichos: EDUCATION, B2B
 * Estratégia: CONSULTATIVE
 *
 * Cenários cobertos:
 * - Q01: Qualificação de lead
 * - Q02: Pedido de orçamento/proposta
 * - Q03: Pedido de falar com humano
 * - Q04: Dúvida sobre serviços
 * - Q05: Follow-up 1h sem resposta
 * - Q06: Retomada após follow-up
 * - Q07: Mensagem urgente
 * - Q08: Múltiplas perguntas
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

const EDUCATION_NICHES: NicheConfig[] = [
  {
    businessType: 'EDUCATION',
    label: 'Escolas & Cursos',
    description: 'Escola com atendimento consultivo por conversa.',
    services: 'Matricula, grade de horarios, valor da mensalidade e informacoes.',
  },
  {
    businessType: 'B2B',
    label: 'Empresas B2B',
    description: 'Empresa B2B com atendimento consultivo.',
    services: 'Qualificacao, proposta comercial, proximos passos e atendimento.',
  },
];

describeLive('Education Niche Live Integration (EDUCATION, B2B)', () => {
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

  for (const niche of filterNiches(EDUCATION_NICHES)) {
    describe(`${niche.businessType} - ${niche.label}`, () => {
      beforeEach(async () => {
        await updateBusinessForNiche(ctx.app, TENANT_ID, niche);
      });

      it('Q01: qualificação de lead', async () => {
        const phone = makePhone(niche.businessType, 'q01-qualify');
        const question = niche.businessType === 'EDUCATION'
          ? 'quero informacoes sobre matricula para meu filho'
          : 'preciso de uma solucao de software para minha empresa';

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
          mustContainAny: ['entender', 'necessidade', 'ajudar', 'informacao', 'servico', 'detalhe'],
        });
      });

      it('Q02: pedido de orçamento/proposta', async () => {
        const phone = makePhone(niche.businessType, 'q02-proposal');
        const turns = niche.businessType === 'EDUCATION'
          ? [
              'quero matricular meu filho',
              'qual o valor da mensalidade e como funciona?',
            ]
          : [
              'preciso de uma proposta comercial',
              'qual o valor e prazo de entrega?',
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
          mustContainAny: ['valor', 'orcamento', 'proposta', 'informacao', 'proximo passo'],
        });
      });

      it('Q03: pedido de falar com humano', async () => {
        const phone = makePhone(niche.businessType, 'q03-handoff');
        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: 'preciso falar com alguem da equipe agora, e urgente',
          externalId: `${phone}-q03-0`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['humano', 'responsavel', 'atendente', 'equipe', 'encaminhar', 'ajudar'],
        });
      });

      it('Q04: dúvida sobre serviços', async () => {
        const phone = makePhone(niche.businessType, 'q04-services');
        const question = niche.businessType === 'EDUCATION'
          ? 'quais cursos voces oferecem?'
          : 'quais servicos voces prestam para empresas?';

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
          text: 'quero saber mais sobre voces',
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
            nextStep: 'Entender necessidade específica',
          },
        });

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 2);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectFollowUpResponse(aiText, ['ajudar', 'duvida', 'informacao', 'servico']);
      });

      it('Q06: retomada após follow-up', async () => {
        const phone = makePhone(niche.businessType, 'q06-resume');
        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: 'quero informacoes',
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
          text: 'sim, quero saber os valores',
          externalId: `${phone}-q06-resume`,
        });

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 3);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectHealthyResponse(aiText);
      });

      it('Q07: mensagem urgente', async () => {
        const phone = makePhone(niche.businessType, 'q07-urgent');
        const question = niche.businessType === 'EDUCATION'
          ? 'preciso resolver a matricula HOJE, e urgente!'
          : 'preciso de uma resposta urgente sobre o contrato';

        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: question,
          externalId: `${phone}-q07-0`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['urgente', 'ajudar', 'resolver', 'prioridade', 'atendente', 'entender'],
        });
      });

      it('Q08: múltiplas perguntas em uma mensagem', async () => {
        const phone = makePhone(niche.businessType, 'q08-multi');
        const question = niche.businessType === 'EDUCATION'
          ? 'qual o valor da mensalidade? tem desconto para pagamento antecipado? e qual o horario das aulas?'
          : 'qual o prazo do contrato? tem multa por cancelamento? e como funciona o suporte?';

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
        // Deve responder a pelo menos 2 das perguntas
        if (niche.businessType === 'EDUCATION') {
          expectAIResponse(aiText, {
            mustContainAny: ['mensalidade', 'valor', 'desconto', 'horario', 'aula'],
          });
        } else {
          expectAIResponse(aiText, {
            mustContainAny: ['contrato', 'prazo', 'cancelamento', 'suporte'],
          });
        }
      });

      it('Q10: horário de funcionamento', async () => {
        const phone = makePhone(niche.businessType, 'q10-hours');
        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: 'qual o horario de atendimento?',
          externalId: `${phone}-q10-0`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['horario', 'atendimento', 'segunda', 'sexta', '08', '20'],
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
