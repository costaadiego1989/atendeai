import { Inject, Injectable } from '@nestjs/common';
import { AI_ENGINE, IAIEngine } from '../ports/IAIEngine';

/**
 * Narrow facade exposing single-shot AI text generation to other modules
 * (e.g. automation `ai_response` step) without leaking the AI engine internals.
 */
export interface IAutomationAiReplyFacade {
  generateReply(input: {
    tenantId: string;
    prompt: string;
    userMessage?: string;
    conversationId?: string | null;
  }): Promise<{ text: string }>;
}

export const AUTOMATION_AI_REPLY_FACADE = 'AUTOMATION_AI_REPLY_FACADE';

@Injectable()
export class AutomationAiReplyFacade implements IAutomationAiReplyFacade {
  constructor(@Inject(AI_ENGINE) private readonly engine: IAIEngine) {}

  async generateReply(input: {
    tenantId: string;
    prompt: string;
    userMessage?: string;
    conversationId?: string | null;
  }): Promise<{ text: string }> {
    const response = await this.engine.generateResponse({
      systemPrompt: input.prompt,
      contextHistory: [],
      userMessage: input.userMessage ?? '',
      maxTokens: 500,
      temperature: 0.7,
      trace: {
        tenantId: input.tenantId,
        conversationId: input.conversationId ?? undefined,
      },
    });

    return { text: response.text };
  }
}
