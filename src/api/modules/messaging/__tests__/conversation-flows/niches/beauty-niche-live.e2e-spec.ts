/**
 * Beauty Niche Live E2E Tests
 *
 * Nichos: BEAUTY, PET, GYM
 * Estratégia: SCHEDULING
 *
 * Cenários cobertos:
 * - S01: Consulta de serviços disponíveis
 * - S03: Consulta de horários para data específica
 * - S05: Agendamento direto
 * - S06: Agendamento por categoria
 * - S07: Remarcação de consulta
 * - S08: Consulta fora do horário
 * - S11: Follow-up 1h sem resposta
 * - S12: Retomada após follow-up
 * - S15: Múltiplas categorias disponíveis
 *
 * Pré-condições:
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

const BEAUTY_NICHES: NicheConfig[] = [
  {
    businessType: 'BEAUTY',
    label: 'Beleza & Estetica',
    description: 'Atendimento por horario em beleza e estetica.',
    services: 'Corte, barba, limpeza de pele e procedimentos esteticos.',
  },
  {
    businessType: 'PET',
    label: 'Petshops & Vets',
    description: 'Petshop com servicos agendados e produtos.',
    services: 'Banho, tosa, vacina, racao e acessorios.',
  },
  {
    businessType: 'GYM',
    label: 'Academias & Studios',
    description: 'Studio com aulas e horarios.',
    services: 'Aula experimental, avaliacao fisica e planos.',
  },
];

describeLive('Beauty Niche Live Integration (BEAUTY, PET, GYM)', () => {
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

  for (const niche of filterNiches(BEAUTY_NICHES)) {
    describe(`${niche.businessType} - ${niche.label}`, () => {
      beforeEach(async () => {
        await updateBusinessForNiche(ctx.app, TENANT_ID, niche);
      });

      it('S01: consulta de serviços disponíveis', async () => {
        const phone = makePhone(niche.businessType, 's01-services');
        const question = niche.businessType === 'PET'
          ? 'quais servicos voces oferecem para meu cachorro?'
          : niche.businessType === 'GYM'
            ? 'quais aulas voces tem?'
            : 'quais servicos de beleza voces fazem?';

        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: question,
          externalId: `${phone}-s01-0`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['servico', 'avaliacao', 'agenda', 'horario', 'disponivel', 'oferecemos'],
        });
      });

      it('S03: consulta de horários para amanhã', async () => {
        const phone = makePhone(niche.businessType, 's03-slots');
        const question = niche.businessType === 'PET'
          ? 'tem horario para banho amanha?'
          : niche.businessType === 'GYM'
            ? 'tem vaga para aula amanha?'
            : 'tem horario para corte amanha?';

        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: question,
          externalId: `${phone}-s03-0`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['horario', 'amanha', '14', '16', '09', '10', 'disponivel'],
        });
      });

      it('S05: agendamento direto com profissional e horário', async () => {
        const phone = makePhone(niche.businessType, 's05-direct');
        const turns = niche.businessType === 'PET'
          ? ['quero agendar banho para amanha', 'as 14h com a Dra Ana', 'confirmar']
          : niche.businessType === 'GYM'
            ? ['quero agendar avaliacao amanha', 'as 14h', 'confirmar']
            : ['quero agendar corte amanha', 'as 14h com a Dra Ana', 'confirmar'];

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
          mustContainAny: ['confirma', 'agendado', 'horario', '14', 'amanha'],
        });
      });

      it('S07: dúvida sobre remarcação', async () => {
        const phone = makePhone(niche.businessType, 's07-reschedule');
        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: 'preciso remarcar meu horario para outro dia, como faco?',
          externalId: `${phone}-s07-0`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['remarcar', 'horario', 'disponibilidade', 'agenda', 'data', 'quando'],
        });
      });

      it('S08: consulta fora do horário', async () => {
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
          mustContainAny: ['horario', 'funcionamento', 'segunda', 'sexta', 'sabado', 'domingo'],
        });
      });

      it('S11: follow-up 1h sem resposta', async () => {
        const phone = makePhone(niche.businessType, 's11-followup');
        const question = niche.businessType === 'PET'
          ? 'quero agendar banho'
          : niche.businessType === 'GYM'
            ? 'quero fazer aula experimental'
            : 'quero agendar limpeza de pele';

        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: question,
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
            summary: `Cliente quer agendar servico`,
            sentiment: 'NEUTRAL',
            tags: ['scheduling'],
            interests: ['agendamento'],
            nextStep: 'Perguntar data e horário',
          },
        });

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 2);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectFollowUpResponse(aiText, ['agendar', 'horario', 'agenda', 'servico']);
      });

      it('S12: retomada após follow-up', async () => {
        const phone = makePhone(niche.businessType, 's12-resume');
        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: 'quero agendar avaliacao',
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

        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: 'sim, pode ser amanha de manha',
          externalId: `${phone}-s12-resume`,
        });

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 3);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectHealthyResponse(aiText);
      });

      it('S06: agendamento por categoria de serviço', async () => {
        const phone = makePhone(niche.businessType, 's06-category');
        await sendConversationTurns({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          turns: ['quero agendar um corte de cabelo', 'amanha as 15h'],
          baseExternalId: `${phone}-s06`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 2);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['corte', 'cabelo', 'agend', 'horario', 'confirm', 'disponivel'],
        });
      });

      it('S15: múltiplas categorias de serviço', async () => {
        const phone = makePhone(niche.businessType, 's15-multi-cat');
        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text: 'quais servicos voces oferecem?',
          externalId: `${phone}-s15-0`,
        });

        const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
        expect(conv).not.toBeNull();

        const messages = await waitForAIResponse(ctx.prisma, conv!.conversationId, 1);
        expect(messages).not.toBeNull();

        const aiText = getOutboundAIText(messages!);
        expectAIResponse(aiText, {
          mustContainAny: ['servico', 'oferecemos', 'disponivel', 'corte', 'manicure', 'tipo', 'opcao'],
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
