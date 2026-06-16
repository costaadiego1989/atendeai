import {
  ConversationHarness,
  bootConversationHarness,
  cleanupTenant,
  createConversation,
  seedTenant,
  sendMessage,
} from '../_support/conversation-harness';

/**
 * GUARD-PROMPT — prompt integrity. Verifies what actually reaches the model:
 * non-empty system prompt, verbatim user message, growing history, widget
 * context hints, max-token budget and trace context.
 */
describe('GUARD-PROMPT (e2e)', () => {
  jest.setTimeout(180000);

  let h: ConversationHarness;
  let tenantId: string;

  beforeAll(async () => {
    h = await bootConversationHarness();
    ({ tenantId } = await seedTenant(h, {
      businessType: 'OTHER',
      description: 'Negocio para testes de prompt.',
      systemPrompt: 'Voce e o atendente da Loja Prompt.',
    }));
  });

  afterAll(async () => {
    await cleanupTenant(h, tenantId);
    await h.close();
  });

  beforeEach(() => {
    h.engine.reset();
    h.events.length = 0;
    h.engine.setFallback({ text: 'ok', confidence: 0.95 });
  });

  it('GUARD-PROMPT-01 system prompt is non-empty', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'ola');
    expect(h.engine.lastRequest!.systemPrompt.length).toBeGreaterThan(0);
  });

  it('GUARD-PROMPT-02 user message reaches the model verbatim', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'mensagem exata do cliente');
    expect(h.engine.lastRequest!.userMessage).toBe('mensagem exata do cliente');
  });

  it('GUARD-PROMPT-03 history accumulates across turns', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'primeira');
    await sendMessage(h, conv, 'segunda');
    expect(h.engine.requests[1].contextHistory.length).toBeGreaterThan(0);
  });

  it('GUARD-PROMPT-04 widget context hints are appended to the prompt', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'quero saber mais', {
      contextHints: ['Plano Premium', 'Origem: site'],
    });
    expect(h.engine.lastRequest!.systemPrompt).toContain('OPÇÕES PRÉ-DEFINIDAS');
    expect(h.engine.lastRequest!.systemPrompt).toContain('Plano Premium');
  });

  it('GUARD-PROMPT-05 max tokens come from the AI config budget', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'ola');
    expect(h.engine.lastRequest!.maxTokens).toBe(1200);
  });

  it('GUARD-PROMPT-06 trace carries the tenant id', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'ola');
    expect(h.engine.lastRequest!.trace?.tenantId).toBe(tenantId);
  });

  it('GUARD-PROMPT-07 trace carries the conversation id', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'ola');
    expect(h.engine.lastRequest!.trace?.conversationId).toBe(
      conv.conversationId,
    );
  });

  it('GUARD-PROMPT-08 no platform limits appended when not configured', async () => {
    const conv = await createConversation(h, tenantId);
    await sendMessage(h, conv, 'ola');
    expect(h.engine.lastRequest!.systemPrompt).not.toContain(
      '[LIMITES_DE_SEGURANCA_DA_PLATAFORMA]',
    );
  });
});
