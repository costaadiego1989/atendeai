import { Inject, Injectable } from '@nestjs/common';
import { AI_ENGINE, IAIEngine } from '../ports/IAIEngine';
import { ICheckQuotaUseCase } from '@modules/billing/application/use-cases/interfaces/ICheckQuotaUseCase';
import { UsageType } from '@modules/billing/application/use-cases/interfaces/IRecordUsageUseCase';

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
  }): Promise<{ text: string; denied?: boolean; reason?: string }>;
}

export const AUTOMATION_AI_REPLY_FACADE = 'AUTOMATION_AI_REPLY_FACADE';

@Injectable()
export class AutomationAiReplyFacade implements IAutomationAiReplyFacade {
  constructor(
    @Inject(AI_ENGINE) private readonly engine: IAIEngine,
    @Inject(ICheckQuotaUseCase)
    private readonly checkQuotaUseCase: ICheckQuotaUseCase,
  ) {}

  async generateReply(input: {
    tenantId: string;
    prompt: string;
    userMessage?: string;
    conversationId?: string | null;
  }): Promise<{ text: string; denied?: boolean; reason?: string }> {
    // Same quota/subscription gate the live reply path enforces
    // (ProcessAIResponseService) — never call the paid engine for a blocked tenant.
    const quota = await this.checkQuotaUseCase.execute({
      tenantId: input.tenantId,
      type: UsageType.AI_TOKEN,
    });
    if (!quota.canProceed) {
      return { text: '', denied: true, reason: quota.status };
    }

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
