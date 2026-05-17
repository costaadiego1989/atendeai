import { AIResponse } from '../ports/IAIEngine';

export interface HumanHandoffDecision {
  shouldHandoff: boolean;
  reason?: string;
}

export class HumanHandoffPolicy {
  evaluate(input: {
    userMessage: string;
    response: AIResponse;
    confidenceThreshold: number;
  }): HumanHandoffDecision {
    const normalizedMessage = input.userMessage.toLowerCase();
    const requestedHuman =
      /(humano|atendente|pessoa|vendedor|especialista)/i.test(
        normalizedMessage,
      );

    if (requestedHuman) {
      return {
        shouldHandoff: true,
        reason: 'USER_REQUESTED_HUMAN',
      };
    }

    if (input.response.confidence < input.confidenceThreshold) {
      return {
        shouldHandoff: true,
        reason: 'LOW_CONFIDENCE',
      };
    }

    if (
      input.response.intent === 'COMPLAINT' ||
      input.response.sentiment === 'NEGATIVE'
    ) {
      return {
        shouldHandoff: true,
        reason: 'SENSITIVE_CONVERSATION',
      };
    }

    return { shouldHandoff: false };
  }
}
