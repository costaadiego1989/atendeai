import { HumanHandoffPolicy } from '../HumanHandoffPolicy';

describe('HumanHandoffPolicy', () => {
  let policy: HumanHandoffPolicy;

  beforeEach(() => {
    policy = new HumanHandoffPolicy();
  });

  it('should trigger handoff when the user explicitly requests a human', () => {
    const result = policy.evaluate({
      userMessage: 'quero falar com um humano',
      response: {
        text: 'Claro',
        tokensUsed: 10,
        confidence: 0.95,
        finishReason: 'stop',
        intent: 'GENERAL',
        sentiment: 'NEUTRAL',
      },
      confidenceThreshold: 0.7,
    });

    expect(result).toEqual({
      shouldHandoff: true,
      reason: 'USER_REQUESTED_HUMAN',
    });
  });

  it('should trigger handoff on low confidence or complaint scenarios', () => {
    const result = policy.evaluate({
      userMessage: 'me ajuda',
      response: {
        text: 'Resposta incerta',
        tokensUsed: 10,
        confidence: 0.3,
        finishReason: 'stop',
        intent: 'QUESTION',
        sentiment: 'NEUTRAL',
      },
      confidenceThreshold: 0.7,
    });

    expect(result.shouldHandoff).toBe(true);
    expect(result.reason).toBe('LOW_CONFIDENCE');
  });
});
