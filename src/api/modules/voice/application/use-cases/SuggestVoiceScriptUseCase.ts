import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

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

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface AnthropicResponse {
  content: AnthropicContentBlock[];
}

@Injectable()
export class SuggestVoiceScriptUseCase {
  constructor(private readonly configService: ConfigService) {}

  async execute(
    _tenantId: string,
    input: { name: string; type: string },
  ): Promise<{ template: string }> {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException(
        'ANTHROPIC_API_KEY not configured',
      );
    }

    const typeLabel = TYPE_LABELS[input.type] ?? input.type;

    const response = await axios.post<AnthropicResponse>(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: SCRIPT_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Crie um script de ${typeLabel} com o título: "${input.name}"`,
          },
        ],
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
      },
    );

    const text = response.data.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('');

    return { template: text };
  }
}
