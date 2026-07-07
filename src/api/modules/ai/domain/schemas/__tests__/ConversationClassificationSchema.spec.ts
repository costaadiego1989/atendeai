import { ConversationClassificationSchema } from '../ConversationClassificationSchema';

describe('ConversationClassificationSchema', () => {
  const validBase = {
    reply: 'Olá, como posso ajudar?',
    confidence: 0.95,
    intent: 'GREETING',
    sentiment: 'NEUTRAL',
  };

  it('accepts valid response without phase (backward compat)', () => {
    const result = ConversationClassificationSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it('accepts valid response with phase and phaseConfidence', () => {
    const result = ConversationClassificationSchema.safeParse({
      ...validBase,
      phase: 'QUALIFICATION',
      phaseConfidence: 0.85,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phase).toBe('QUALIFICATION');
      expect(result.data.phaseConfidence).toBe(0.85);
    }
  });

  it('accepts phase without phaseConfidence', () => {
    const result = ConversationClassificationSchema.safeParse({
      ...validBase,
      phase: 'CHECKOUT',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing reply', () => {
    const { reply, ...noReply } = validBase;
    const result = ConversationClassificationSchema.safeParse(noReply);
    expect(result.success).toBe(false);
  });

  it('rejects invalid intent', () => {
    const result = ConversationClassificationSchema.safeParse({
      ...validBase,
      intent: 'INVALID',
    });
    expect(result.success).toBe(false);
  });

  it('rejects phaseConfidence out of range', () => {
    const result = ConversationClassificationSchema.safeParse({
      ...validBase,
      phase: 'GREETING',
      phaseConfidence: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects confidence out of range', () => {
    const result = ConversationClassificationSchema.safeParse({
      ...validBase,
      confidence: -0.1,
    });
    expect(result.success).toBe(false);
  });
});
