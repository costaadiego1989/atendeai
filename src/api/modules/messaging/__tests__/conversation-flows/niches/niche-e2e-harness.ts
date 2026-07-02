/**
 * Niche E2E Harness
 *
 * Harness compartilhado para testes de conversa expandidos por nicho.
 * Usa gateway de pagamento real (Asaas sandbox) e IA real (DeepSeek).
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
  normalize,
} from './helpers/signal-assertions';
import {
  ensureBillingReady,
  ensureWhatsAppReady,
  updateBusinessForNiche,
  seedSchedulingFixtures,
  seedCommerceFixtures,
  saveTenantSnapshot,
  restoreTenantSnapshot,
  NicheConfig,
} from './helpers/niche-seed-fixtures';

export const TENANT_ID =
  process.env.CONVERSATION_FLOW_TENANT_ID ||
  '2eef4a95-f5a3-435f-bde8-2098a385961a';

export interface ConversationQuestion {
  key: string;
  question: string;
  expectedSignals: string[];
  category: 'welcome' | 'info' | 'purchase' | 'scheduling' | 'pricing' | 'professional' | 'location' | 'safety' | 'general' | 'payment' | 'support' | 'menu_reset';
}

export interface ExpandedNicheConfig {
  config: NicheConfig;
  companyName: string;
  questions: ConversationQuestion[];
  hasScheduling: boolean;
  hasCommerce: boolean;
}

export async function bootNicheHarness(): Promise<{
  ctx: LiveTestContext;
  snapshot: any;
}> {
  const ctx = await createLiveTestApp({ useRealPaymentGateway: true });
  const snapshot = await saveTenantSnapshot(ctx.prisma, TENANT_ID);
  await ensureBillingReady(ctx.prisma, TENANT_ID);
  await ensureWhatsAppReady(ctx.prisma, TENANT_ID);
  return { ctx, snapshot };
}

export async function teardownNicheHarness(
  ctx: LiveTestContext,
  snapshot: any,
): Promise<void> {
  if (ctx?.prisma && snapshot) {
    await restoreTenantSnapshot(ctx.prisma, TENANT_ID, snapshot);
  }
  if (ctx?.app) {
    await ctx.app.close();
  }
}

export async function setupNiche(
  ctx: LiveTestContext,
  niche: ExpandedNicheConfig,
): Promise<void> {
  await updateBusinessForNiche(ctx.app, TENANT_ID, niche.config);
  if (niche.hasScheduling) {
    await seedSchedulingFixtures(ctx.app, TENANT_ID);
  }
  if (niche.hasCommerce) {
    await seedCommerceFixtures(ctx.app, TENANT_ID);
  }
}

export async function sendAndGetReply(
  ctx: LiveTestContext,
  nicheKey: string,
  scenarioKey: string,
  text: string,
): Promise<string> {
  const phone = makePhone(nicheKey, scenarioKey);
  const externalId = `${phone}-${scenarioKey}-${Date.now()}`;

  await sendInboundMessage({
    app: ctx.app,
    prisma: ctx.prisma,
    tenantId: TENANT_ID,
    phone,
    text,
    externalId,
  });

  const conv = await waitForConversation(ctx.prisma, TENANT_ID, phone);
  if (!conv) throw new Error(`No conversation after: "${text}"`);

  const messages = await waitForAIResponse(ctx.prisma, conv.conversationId, 1);
  if (!messages) throw new Error(`No AI response after: "${text}"`);

  return getOutboundAIText(messages);
}

export function validateReply(
  reply: string,
  expectedSignals: string[],
  category: string,
): void {
  if (category === 'safety') {
    // Safety: either blocked (empty/short) or returns a safe fallback
    expectHealthyResponse(reply);
    return;
  }

  expectAIResponse(reply, {
    mustContainAny: expectedSignals,
    mustNotContain: [
      'deepseek', 'api key', 'undefined', 'null',
      'internal error', 'TypeError', 'NestJS',
    ],
  });
}

export { expectAIResponse, expectHealthyResponse, normalize };
