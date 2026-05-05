import { Inject, Injectable } from '@nestjs/common';
import { AI_ENGINE, IAIEngine } from '@modules/ai/application/ports/IAIEngine';

@Injectable()
export class DraftTenantAdminMessageUseCase {
  constructor(
    @Inject(AI_ENGINE)
    private readonly ai: IAIEngine,
  ) {}

  async execute(input: {
    intent: 'QUOTA_WARNING' | 'CUSTOM';
    locale: 'pt-BR';
    tenantSummary: string;
    operatorHint?: string;
  }) {
    const system =
      'You write short WhatsApp messages in Brazilian Portuguese, professional and clear. ' +
      'No markdown. Max ~600 characters. Output only the message body.';
    const user =
      input.intent === 'QUOTA_WARNING'
        ? `Tenant context:\n${input.tenantSummary}\nWrite a polite quota alert.`
        : `Tenant context:\n${input.tenantSummary}\nOperator instruction: ${input.operatorHint ?? ''}`;
    const res = await this.ai.generateResponse({
      systemPrompt: system,
      contextHistory: [],
      userMessage: user,
      maxTokens: 400,
      temperature: 0.4,
    });
    return { text: res.text.trim() };
  }
}
