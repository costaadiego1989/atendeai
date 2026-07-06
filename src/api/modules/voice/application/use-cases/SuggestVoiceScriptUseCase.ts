import { Inject, Injectable } from '@nestjs/common';
import { AI_ENGINE, IAIEngine } from '@modules/ai/application/ports/IAIEngine';

const SCRIPT_SYSTEM_PROMPT = `Você é um especialista em scripts de cobrança e atendimento telefônico em português brasileiro.
Gere um script de conversa para agente de voz com base no título e tipo fornecidos.
O script deve usar variáveis como {nome}, {valor}, {vencimento}, {agente}, {empresa}.
Seja objetivo, profissional e respeitoso. Retorne APENAS o texto do script, sem explicações adicionais.
O script deve ter entre 3 a 6 parágrafos curtos, simulando um diálogo natural de atendimento telefônico.`;

const TYPE_LABELS: Record<string, string> = {
  recovery: 'cobrança de dívida',
  confirmation: 'confirmação de agendamento',
  follow_up: 'follow-up pós-atendimento',
  custom: 'atendimento geral',
};

@Injectable()
export class SuggestVoiceScriptUseCase {
  constructor(
    @Inject(AI_ENGINE)
    private readonly aiEngine: IAIEngine,
  ) {}

  async execute(
    _tenantId: string,
    input: { name: string; type: string },
  ): Promise<{ template: string }> {
    const typeLabel = TYPE_LABELS[input.type] ?? input.type;

    const text = await this.aiEngine.generateTextResponse({
      systemPrompt: SCRIPT_SYSTEM_PROMPT,
      userMessage: `Crie um script de ${typeLabel} com o título: "${input.name}"`,
      maxTokens: 600,
      temperature: 0.7,
    });

    return { template: text };
  }
}
