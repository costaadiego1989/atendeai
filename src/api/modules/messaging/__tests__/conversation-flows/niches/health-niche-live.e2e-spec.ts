/**
 * Health Niche Live E2E Tests
 *
 * Nichos: HEALTH, CLINIC, SCHEDULING
 * Estratégia: SCHEDULING
 *
 * Cenários cobertos:
 * - S01: Consulta de serviços disponíveis
 * - S02: Consulta de profissionais
 * - S03: Consulta de horários para data específica
 * - S05: Agendamento direto (profissional + horário)
 * - S06: Agendamento por categoria (sem profissional)
 * - S08: Consulta fora do horário de funcionamento
 * - S10: Todos slots ocupados
 * - S11: Follow-up 1h sem resposta
 * - S12: Retomada após follow-up
 * - S14: Consulta gratuita (sem preço)
 * - S15: Múltiplas categorias disponíveis
 *
 * Pré-condições:
 * - Tenant com billing ativo
 * - WhatsApp config (Twilio)
 * - Scheduling categories e professionals configurados
 * - Availability para amanhã
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

const HEALTH_NICHES: NicheConfig[] = [
  {
    businessType: 'HEALTH',
    label: 'Clinicas & Saude',
    description: 'Clinica com profissionais, categorias e agenda.',
    services: 'Avaliacao, consulta, clareamento e retornos.',
  },
  {
    businessType: 'CLINIC',
    label: 'Clinica',
    description: 'Clínica com agenda especializada.',
    services: 'Avaliação, consulta e procedimentos.',
  },
  {
    businessType: 'SCHEDULING',
    label: 'Servico com agenda',
    description: 'Serviço profissional com agenda estruturada.',
    services: 'Consulta, atendimento, avaliação e remarcação.',
  },
];

describeLive('Health Niche Live Integration (HEALTH, CLINIC, SCHEDULING)', () => {
  jest.setTimeout(360000);

  let ctx: LiveTestContext;
  let snapshot: any;

  beforeAll(async () => {
    ctx = await createLiveTestApp();
    snapshot = await saveTenantSnapshot(ctx.prisma, TENANT_ID);
    await ensureBillingReady(ctx.prisma, TENANT_ID);
    await ensureWhatsAppReady(ctx.prisma, TENANT_ID);
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

  for (const niche of filterNiches(HEALTH_NICHES)) {
    describe(`${niche.businessType} - ${niche.label}`, () => {
      beforeEach(async () => {
        await updateBusinessForNiche(ctx.app, TENANT_ID, niche);
      });

      it('S01: consulta de serviços disponíveis', async () => {
        const phone = makePhone(niche.businessType, 's01-services');
        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: 'quais servicos voces oferecem?',
          externalId: `${phone}-s01-0`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['servico', 'avaliacao', 'consulta', 'agenda', 'horario', 'disponivel'],
        });
      });

      it('S02: consulta de profissionais', async () => {
        const phone = makePhone(niche.businessType, 's02-professionals');
        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: 'quais profissionais atendem?',
          externalId: `${phone}-s02-0`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['profissional', 'dra', 'ana', 'especialista', 'atende'],
        });
      });

      it('S03: consulta de horários para amanhã', async () => {
        const phone = makePhone(niche.businessType, 's03-slots');
        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: 'quais horarios disponiveis para amanha?',
          externalId: `${phone}-s03-0`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['horario', 'amanha', '14', '16', '09', '10', 'disponivel', 'agenda'],
        });
      });

      it('S05: agendamento direto com profissional e horário', async () => {
        const phone = makePhone(niche.businessType, 's05-direct');
        const turns = [
          'quero marcar uma avaliacao amanha',
          'com a Dra Ana as 14h',
          'confirmar',
        ];

        await sendConversationTurns({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          turns,
          baseExternalId: `${phone}-s05`,
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
          mustContainAny: ['confirma', 'agendado', 'horario', '14', 'ana', 'avaliacao'],
        });
      });

      it('S06: agendamento por categoria sem especificar profissional', async () => {
        const phone = makePhone(niche.businessType, 's06-category');
        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: 'quero agendar uma avaliacao',
          externalId: `${phone}-s06-0`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['profissional', 'horario', 'agenda', 'disponivel', 'avaliacao', 'quando'],
        });
      });

      it('S08: consulta fora do horário de funcionamento', async () => {
        const phone = makePhone(niche.businessType, 's08-closed');
        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: 'voces atendem domingo?',
          externalId: `${phone}-s08-0`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['horario', 'funcionamento', 'segunda', 'sexta', 'sabado', 'domingo', 'atendemos'],
        });
      });

      it('S11: follow-up 1h sem resposta', async () => {
        const phone = makePhone(niche.businessType, 's11-followup');
        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: 'quero agendar uma consulta',
          externalId: `${phone}-s11-0`,
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
            summary: 'Cliente quer agendar consulta',
            sentiment: 'NEUTRAL',
            tags: ['scheduling', 'consulta'],
            interests: ['consulta', 'avaliacao'],
            nextStep: 'Perguntar data e horário preferido',
          },
        });

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 2);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectFollowUpResponse(aiText, ['consulta', 'agendar', 'horario', 'agenda']);
      });

      it('S12: retomada após follow-up', async () => {
        const phone = makePhone(niche.businessType, 's12-resume');
        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: 'quero marcar avaliacao',
          externalId: `${phone}-s12-0`,
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
            summary: 'Cliente quer avaliação',
            sentiment: 'NEUTRAL',
            interests: ['avaliacao'],
          },
        });

        await waitForAIResponse(ctx.prisma, conv!.conversationId, 2);

        // User retoma
        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: 'sim, pode ser amanha as 14h',
          externalId: `${phone}-s12-resume`,
        });

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 3);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectHealthyResponse(aiText);
      });

      it('S10: todos os horários ocupados', async () => {
        const phone = makePhone(niche.businessType, 's10-full');
        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: 'quero agendar consulta para hoje as 10h',
          externalId: `${phone}-s10-0`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['horario', 'disponivel', 'agenda', 'outro', 'alternativa', 'consulta', 'agendar'],
        });
      });

      it('S14: consulta gratuita / avaliação', async () => {
        const phone = makePhone(niche.businessType, 's14-free');
        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: 'voces fazem avaliacao gratuita?',
          externalId: `${phone}-s14-0`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['avaliacao', 'gratuita', 'consulta', 'agendar', 'horario', 'disponivel'],
        });
      });

      it('S15: múltiplas categorias de serviço', async () => {
        const phone = makePhone(niche.businessType, 's15-multi-cat');
        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: 'quais tipos de consulta voces oferecem?',
          externalId: `${phone}-s15-0`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['consulta', 'servico', 'tipo', 'especialidade', 'oferecemos', 'disponivel'],
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
