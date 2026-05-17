import { HumanHandoffPolicy } from '../application/services/HumanHandoffPolicy';
import { AIResponse } from '../application/ports/IAIEngine';

function makeResponse(overrides: Partial<AIResponse> = {}): AIResponse {
  return {
    text: 'Resposta padrão',
    tokensUsed: 50,
    confidence: 0.9,
    finishReason: 'stop',
    intent: 'GENERAL',
    sentiment: 'NEUTRAL',
    ...overrides,
  };
}

describe('HumanHandoffPolicy', () => {
  let policy: HumanHandoffPolicy;

  beforeEach(() => {
    policy = new HumanHandoffPolicy();
  });

  describe('user requested human keywords', () => {
    it.each(['humano', 'atendente', 'pessoa', 'vendedor', 'especialista'])(
      'should handoff when user message contains "%s"',
      (keyword) => {
        const result = policy.evaluate({
          userMessage: `Quero falar com um ${keyword}`,
          response: makeResponse(),
          confidenceThreshold: 0.7,
        });

        expect(result).toEqual({
          shouldHandoff: true,
          reason: 'USER_REQUESTED_HUMAN',
        });
      },
    );

    it('should detect keyword case-insensitively', () => {
      const result = policy.evaluate({
        userMessage: 'Preciso de um ATENDENTE agora',
        response: makeResponse(),
        confidenceThreshold: 0.7,
      });

      expect(result).toEqual({
        shouldHandoff: true,
        reason: 'USER_REQUESTED_HUMAN',
      });
    });
  });

  describe('low confidence', () => {
    it('should handoff when confidence is below threshold', () => {
      const result = policy.evaluate({
        userMessage: 'Qual o preço do plano?',
        response: makeResponse({ confidence: 0.3 }),
        confidenceThreshold: 0.7,
      });

      expect(result).toEqual({
        shouldHandoff: true,
        reason: 'LOW_CONFIDENCE',
      });
    });

    it('should handoff when confidence is exactly at zero', () => {
      const result = policy.evaluate({
        userMessage: 'Algo estranho',
        response: makeResponse({ confidence: 0 }),
        confidenceThreshold: 0.7,
      });

      expect(result).toEqual({
        shouldHandoff: true,
        reason: 'LOW_CONFIDENCE',
      });
    });

    it('should NOT handoff when confidence equals threshold', () => {
      const result = policy.evaluate({
        userMessage: 'Qual o preço do plano?',
        response: makeResponse({ confidence: 0.7 }),
        confidenceThreshold: 0.7,
      });

      expect(result).toEqual({ shouldHandoff: false });
    });
  });

  describe('sensitive conversation (COMPLAINT intent)', () => {
    it('should handoff when intent is COMPLAINT', () => {
      const result = policy.evaluate({
        userMessage: 'Estou insatisfeito com o serviço',
        response: makeResponse({ intent: 'COMPLAINT', confidence: 0.95 }),
        confidenceThreshold: 0.7,
      });

      expect(result).toEqual({
        shouldHandoff: true,
        reason: 'SENSITIVE_CONVERSATION',
      });
    });
  });

  describe('sensitive conversation (NEGATIVE sentiment)', () => {
    it('should handoff when sentiment is NEGATIVE', () => {
      const result = policy.evaluate({
        userMessage: 'Isso é péssimo',
        response: makeResponse({ sentiment: 'NEGATIVE', confidence: 0.95 }),
        confidenceThreshold: 0.7,
      });

      expect(result).toEqual({
        shouldHandoff: true,
        reason: 'SENSITIVE_CONVERSATION',
      });
    });
  });

  describe('no handoff scenarios', () => {
    it('should NOT handoff when all conditions are normal', () => {
      const result = policy.evaluate({
        userMessage: 'Quais serviços vocês oferecem?',
        response: makeResponse({
          confidence: 0.85,
          intent: 'QUESTION',
          sentiment: 'NEUTRAL',
        }),
        confidenceThreshold: 0.7,
      });

      expect(result).toEqual({ shouldHandoff: false });
    });

    it('should NOT handoff with POSITIVE sentiment and high confidence', () => {
      const result = policy.evaluate({
        userMessage: 'Adorei o atendimento!',
        response: makeResponse({
          confidence: 0.95,
          intent: 'GREETING',
          sentiment: 'POSITIVE',
        }),
        confidenceThreshold: 0.7,
      });

      expect(result).toEqual({ shouldHandoff: false });
    });
  });

  describe('priority: user keyword takes precedence over other checks', () => {
    it('should return USER_REQUESTED_HUMAN even if confidence is high', () => {
      const result = policy.evaluate({
        userMessage: 'Quero falar com um humano por favor',
        response: makeResponse({
          confidence: 0.99,
          intent: 'GREETING',
          sentiment: 'POSITIVE',
        }),
        confidenceThreshold: 0.7,
      });

      expect(result).toEqual({
        shouldHandoff: true,
        reason: 'USER_REQUESTED_HUMAN',
      });
    });
  });
});
