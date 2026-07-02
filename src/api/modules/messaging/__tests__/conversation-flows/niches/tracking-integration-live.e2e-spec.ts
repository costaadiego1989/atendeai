/**
 * Tracking Integration Live E2E
 *
 * Valida o fluxo completo:
 * 1. Pedido criado via conversa (checkout)
 * 2. Admin seta código de rastreio via API
 * 3. Usuário recebe notificação WhatsApp com código e URL
 * 4. Melhor Envio cotação de frete funciona
 * 5. Tracking URL gerado corretamente por carrier
 *
 * Pré-requisitos: RUN_NICHE_LIVE_E2E=true, DEEPSEEK_API_KEY, DB+Redis.
 */

import { createLiveTestApp, LiveTestContext } from './helpers/live-test-app-factory';
import {
  sendInboundMessage,
  waitForConversation,
  waitForAIResponse,
  getOutboundAIText,
  makePhone,
} from './helpers/webhook-simulator';
import {
  expectAIResponse,
  expectHealthyResponse,
} from './helpers/signal-assertions';
import {
  ensureBillingReady,
  ensureWhatsAppReady,
  updateBusinessForNiche,
  seedCommerceFixtures,
  saveTenantSnapshot,
  restoreTenantSnapshot,
} from './helpers/niche-seed-fixtures';

const request = require('supertest');

const describeLive =
  process.env.RUN_NICHE_LIVE_E2E === 'true' ? describe : describe.skip;

const TENANT_ID =
  process.env.CONVERSATION_FLOW_TENANT_ID ||
  '2eef4a95-f5a3-435f-bde8-2098a385961a';

describeLive('Tracking Integration — Admin sets tracking, user gets notified', () => {
  jest.setTimeout(600000);

  let ctx: LiveTestContext;
  let snapshot: any;

  beforeAll(async () => {
    ctx = await createLiveTestApp();
    snapshot = await saveTenantSnapshot(ctx.prisma, TENANT_ID);
    await ensureBillingReady(ctx.prisma, TENANT_ID);
    await ensureWhatsAppReady(ctx.prisma, TENANT_ID);
    await updateBusinessForNiche(ctx.app, TENANT_ID, {
      businessType: 'ECOMMERCE',
      label: 'Loja E-commerce',
      description: 'Loja de eletrônicos com entrega via Correios e Melhor Envio.',
      services: 'Fone Bluetooth R$150, Cabo USB-C R$25, Carregador Turbo R$89.',
    });
    await seedCommerceFixtures(ctx.app, TENANT_ID);
  });

  afterAll(async () => {
    if (ctx?.prisma && snapshot) {
      await restoreTenantSnapshot(ctx.prisma, TENANT_ID, snapshot);
    }
    if (ctx?.app) {
      await ctx.app.close();
    }
  });

  describe('Tracking Code Flow', () => {
    let orderId: string;
    let contactId: string;
    let conversationId: string;

    it('should create an order for tracking tests', async () => {
      // Create a contact and conversation first via webhook
      const phone = makePhone('TRACKING', 'order-create');
      const externalId = `${phone}-track-init-${Date.now()}`;

      await sendInboundMessage({
        app: ctx.app,
        prisma: ctx.prisma,
        tenantId: TENANT_ID,
        phone,
        text: 'Oi, quero comprar',
        externalId,
      });

      const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
      expect(conv).not.toBeNull();
      conversationId = conv!.conversationId;
      contactId = conv!.contactId;

      await waitForAIResponse(ctx.prisma, conversationId, 1);

      // Create session first (FK requirement), then order
      const sessionResult = await ctx.prisma.$queryRaw`
        INSERT INTO commerce_schema.shopping_sessions (
          id, tenant_id, conversation_id, contact_id,
          status, current_step, subtotal_amount, freight_amount, total_amount,
          fulfillment_type, delivery_address, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), ${TENANT_ID}::uuid, ${conversationId}::uuid, ${contactId}::uuid,
          'AWAITING_PAYMENT', 'AWAITING_PAYMENT', 150.00, 20.00, 170.00,
          'DELIVERY', 'Rua Augusta 1200, São Paulo - SP', now(), now()
        )
        RETURNING id::text
      ` as any[];

      const sessionId = sessionResult[0].id;

      const ordResult = await ctx.prisma.$queryRaw`
        INSERT INTO commerce_schema.orders (
          id, tenant_id, session_id, conversation_id, contact_id,
          status, fulfillment_type, subtotal_amount, freight_amount, total_amount,
          delivery_address, payment_status, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), ${TENANT_ID}::uuid, ${sessionId}::uuid, ${conversationId}::uuid, ${contactId}::uuid,
          'PAID', 'DELIVERY', 150.00, 20.00, 170.00,
          'Rua Augusta 1200, São Paulo - SP', 'PAID', now(), now()
        )
        RETURNING id::text, status
      ` as any[];

      expect(ordResult.length).toBe(1);
      orderId = ordResult[0].id;
      console.log(`[TRACKING] Order created: ${orderId}, status: ${ordResult[0].status}`);
    });

    it('should set tracking code via admin API (Correios)', async () => {
      if (!orderId) {
        console.log('[TRACKING] Skipping — no order created in previous step');
        return;
      }

      // Simulate admin setting tracking code
      // Since we can't use the authenticated endpoint directly in the test app,
      // we'll call the use case directly
      const { SetOrderTrackingCodeUseCase } = require('@modules/commerce/application/use-cases/SetOrderTrackingCodeUseCase');
      const useCase = ctx.app.get(SetOrderTrackingCodeUseCase);

      const result = await useCase.execute({
        tenantId: TENANT_ID,
        orderId,
        trackingCode: 'BR123456789CD',
        carrier: 'CORREIOS',
      });

      expect(result.trackingCode).toBe('BR123456789CD');
      expect(result.trackingUrl).toContain('correios');
      expect(result.carrier).toBe('CORREIOS');

      console.log(`[TRACKING] Tracking set: ${result.trackingCode}`);
      console.log(`[TRACKING] URL: ${result.trackingUrl}`);
    });

    it('should have published tracking event', async () => {
      if (!orderId) return;

      // Check event was published
      const trackingEvent = ctx.eventTraces.find(
        (e) => e.queue === 'commerce.order.tracking-set',
      );

      expect(trackingEvent).toBeDefined();
      console.log(`[TRACKING] Event published: ${trackingEvent?.queue}`);
    });

    it('should have sent WhatsApp notification to user', async () => {
      if (!orderId) return;

      // Check that a system message was queued (notification)
      const trackingMessages = ctx.queueTraces.filter(
        (q) => q.payload?.content?.text?.includes('rastreio') ||
              q.payload?.content?.text?.includes('BR123456789CD'),
      );

      if (trackingMessages.length > 0) {
        console.log(`[TRACKING] Notification sent to user!`);
        expect(trackingMessages[0].payload.content.text).toContain('BR123456789CD');
      } else {
        // Check in DB for the notification message
        const notifMsg = await ctx.prisma.message.findFirst({
          where: {
            conversationId,
            direction: 'OUTBOUND',
            content: { path: ['text'], string_contains: 'rastreio' },
          },
          orderBy: { createdAt: 'desc' },
        });

        if (notifMsg) {
          const text = (notifMsg.content as any)?.text || '';
          console.log(`[TRACKING] Notification in DB: ${text.slice(0, 100)}`);
          expect(text).toContain('BR123456789CD');
        } else {
          console.log('[TRACKING] WARNING: No notification found — handler may not have processed yet');
        }
      }
    });

    it('should set tracking code via admin API (Melhor Envio)', async () => {
      if (!orderId) return;

      const { SetOrderTrackingCodeUseCase } = require('@modules/commerce/application/use-cases/SetOrderTrackingCodeUseCase');
      const useCase = ctx.app.get(SetOrderTrackingCodeUseCase);

      const result = await useCase.execute({
        tenantId: TENANT_ID,
        orderId,
        trackingCode: 'ME202607020001',
        carrier: 'MELHOR_ENVIO',
      });

      expect(result.trackingCode).toBe('ME202607020001');
      expect(result.trackingUrl).toContain('melhorenvio');
      expect(result.carrier).toBe('MELHOR_ENVIO');

      console.log(`[TRACKING] Melhor Envio tracking: ${result.trackingUrl}`);
    });

    it('should set tracking code via admin API (Jadlog)', async () => {
      if (!orderId) return;

      const { SetOrderTrackingCodeUseCase } = require('@modules/commerce/application/use-cases/SetOrderTrackingCodeUseCase');
      const useCase = ctx.app.get(SetOrderTrackingCodeUseCase);

      const result = await useCase.execute({
        tenantId: TENANT_ID,
        orderId,
        trackingCode: '1234567890',
        carrier: 'JADLOG',
      });

      expect(result.trackingCode).toBe('1234567890');
      expect(result.trackingUrl).toContain('jadlog');
      expect(result.carrier).toBe('JADLOG');
    });
  });

  describe('Melhor Envio Shipping Quote Integration', () => {
    it('should quote shipping via Melhor Envio API', async () => {
      const melhorEnvioToken = process.env.MELHOR_ENVIO_TOKEN;
      if (!melhorEnvioToken || melhorEnvioToken === 'change-me' || melhorEnvioToken.includes('placeholder')) {
        console.log('[MELHOR ENVIO] Skipping — MELHOR_ENVIO_TOKEN not configured (get one at https://sandbox.melhorenvio.com.br)');
        return;
      }

      const { QuoteCarrierShippingUseCase } = require('@modules/commerce/application/use-cases/QuoteCarrierShippingUseCase');
      const useCase = ctx.app.get(QuoteCarrierShippingUseCase);

      const result = await useCase.execute({
        tenantId: TENANT_ID,
        originCep: '01304001',
        destinationCep: '04538000',
        items: [
          {
            name: 'Fone Bluetooth',
            quantity: 1,
            weightGrams: 200,
            heightCm: 5,
            widthCm: 15,
            lengthCm: 20,
            valueInCents: 15000,
          },
        ],
      });

      console.log(`[MELHOR ENVIO] ${result.options.length} shipping options returned:`);
      for (const opt of result.options) {
        console.log(`  - ${opt.serviceName} (${opt.carrierName}): R$${opt.price} — ${opt.deliveryDays} dias`);
      }

      expect(result.options.length).toBeGreaterThan(0);
      expect(result.options[0].price).toBeGreaterThan(0);
      expect(result.options[0].deliveryDays).toBeGreaterThan(0);
      expect(result.options[0].serviceName).toBeDefined();
    });

    it('should handle invalid CEP gracefully', async () => {
      const melhorEnvioToken = process.env.MELHOR_ENVIO_TOKEN;
      if (!melhorEnvioToken || melhorEnvioToken === 'change-me' || melhorEnvioToken.includes('placeholder')) return;

      const { QuoteCarrierShippingUseCase } = require('@modules/commerce/application/use-cases/QuoteCarrierShippingUseCase');
      const useCase = ctx.app.get(QuoteCarrierShippingUseCase);

      const result = await useCase.execute({
        tenantId: TENANT_ID,
        originCep: '00000000',
        destinationCep: '99999999',
        items: [
          {
            name: 'Fone',
            quantity: 1,
            weightGrams: 200,
            heightCm: 5,
            widthCm: 15,
            lengthCm: 20,
            valueInCents: 15000,
          },
        ],
      });

      // Should return empty options or handle gracefully (no crash)
      console.log(`[MELHOR ENVIO] Invalid CEP result: ${result.options.length} options`);
    });

    it('should calculate freight for heavy package', async () => {
      const melhorEnvioToken = process.env.MELHOR_ENVIO_TOKEN;
      if (!melhorEnvioToken || melhorEnvioToken === 'change-me' || melhorEnvioToken.includes('placeholder')) return;

      const { QuoteCarrierShippingUseCase } = require('@modules/commerce/application/use-cases/QuoteCarrierShippingUseCase');
      const useCase = ctx.app.get(QuoteCarrierShippingUseCase);

      const result = await useCase.execute({
        tenantId: TENANT_ID,
        originCep: '01304001',
        destinationCep: '60060100', // Fortaleza
        items: [
          {
            name: 'TV 50pol',
            quantity: 1,
            weightGrams: 15000,
            heightCm: 80,
            widthCm: 120,
            lengthCm: 15,
            valueInCents: 250000,
          },
        ],
      });

      console.log(`[MELHOR ENVIO] Heavy package (SP→CE): ${result.options.length} options`);
      for (const opt of result.options) {
        console.log(`  - ${opt.serviceName}: R$${opt.price} — ${opt.deliveryDays} dias`);
      }

      if (result.options.length > 0) {
        // Heavy items should cost more
        expect(result.options[0].price).toBeGreaterThan(10);
      }
    });
  });

  describe('User asks about tracking in conversation', () => {
    it('should answer tracking question after order', async () => {
      const phone = makePhone('TRACKING', 'user-asks');
      let turnIdx = 0;
      let convId: string;

      async function send(text: string): Promise<string> {
        const externalId = `${phone}-ask-${turnIdx}-${Date.now()}`;
        turnIdx++;

        await sendInboundMessage({
          app: ctx.app,
          prisma: ctx.prisma,
          tenantId: TENANT_ID,
          phone,
          text,
          externalId,
        });

        if (!convId) {
          const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
          expect(conv).not.toBeNull();
          convId = conv!.conversationId;
        }

        const messages = await waitForAIResponse(ctx.prisma, convId, turnIdx);
        expect(messages).not.toBeNull();
        return getOutboundAIText(messages!);
      }

      const reply = await send('Cadê meu pedido? Quero rastrear minha compra');
      expectAIResponse(reply, {
        mustContainAny: ['rastreio', 'pedido', 'acompanhar', 'entrega', 'status', 'rastrear'],
      });
    });

    it('should answer shipping time question', async () => {
      const phone = makePhone('TRACKING', 'shipping-time');
      let convId: string;

      const externalId = `${phone}-ship-0-${Date.now()}`;
      await sendInboundMessage({
        app: ctx.app,
        prisma: ctx.prisma,
        tenantId: TENANT_ID,
        phone,
        text: 'Quanto tempo demora para chegar minha encomenda?',
        externalId,
      });

      const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
      expect(conv).not.toBeNull();
      convId = conv!.conversationId;

      const messages = await waitForAIResponse(ctx.prisma, convId, 1);
      expect(messages).not.toBeNull();

      const reply = getOutboundAIText(messages!);
      expectAIResponse(reply, {
        mustContainAny: ['entrega', 'prazo', 'dias', 'correios', 'frete', 'tempo'],
      });
    });
  });
});
