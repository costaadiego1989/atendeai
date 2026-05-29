import { Inject, Injectable, Logger } from '@nestjs/common';
import { AI_ENGINE, IAIEngine } from '@modules/ai/application/ports/IAIEngine';
import {
  IRecoveryGuidanceGenerator,
  RecoveryGuidanceInput,
  RecoveryGuidanceOutput,
} from '../../application/ports/IRecoveryGuidanceGenerator';

@Injectable()
export class AIRecoveryGuidanceGenerator implements IRecoveryGuidanceGenerator {
  private readonly logger = new Logger(AIRecoveryGuidanceGenerator.name);

  constructor(
    @Inject(AI_ENGINE)
    private readonly aiEngine: IAIEngine,
  ) {}

  async generate(
    input: RecoveryGuidanceInput,
  ): Promise<RecoveryGuidanceOutput> {
    try {
      const response = await this.aiEngine.generateResponse({
        systemPrompt: `Voce e um assistente operacional de recovery por WhatsApp.
Responda APENAS em JSON valido com este formato:
{"suggestedReply":"...","suggestedNextAction":"..."}

Regras:
- suggestedReply deve ser curta, educada, persuasiva e pronta para enviar.
- suggestedNextAction deve ser operacional, objetiva e curta.
- Se status for READY_TO_CONTACT ou CONTACTED, foque em retomar a conversa e abrir espaço para negociação.
- Se status for NEGOTIATING, foque em esclarecer, negociar e avancar para pagamento.
- Se status for PROMISE_TO_PAY, foque em confirmar prazo, combinar acompanhamento e reduzir risco de esquecimento.
- Se status for NO_RESPONSE, foque em reengajar de forma respeitosa.
- Use o contexto da cobrança quando houver para deixar a resposta especifica.
- Nunca inclua markdown, comentarios ou texto fora do JSON.`,
        contextHistory: [],
        userMessage: JSON.stringify({
          debtorName: input.debtorName,
          debtorCompanyName: input.debtorCompanyName ?? null,
          chargeType: input.chargeType ?? null,
          chargeTitle: input.chargeTitle ?? null,
          chargeDescription: input.chargeDescription ?? null,
          referencePeriod: input.referencePeriod ?? null,
          relatedEntityType: input.relatedEntityType ?? null,
          relatedEntityLabel: input.relatedEntityLabel ?? null,
          amountDue: input.amountDue,
          dueDate: input.dueDate?.toISOString() ?? null,
          status: input.status,
          customerMessage: input.customerMessage ?? null,
        }),
        maxTokens: 250,
        temperature: 0.2,
      });

      const parsed = this.parseGuidance(response.text);
      if (parsed) {
        return parsed;
      }

      this.logger.warn({
        message: 'AI recovery guidance fallback triggered',
        adapter: AIRecoveryGuidanceGenerator.name,
        reason: 'invalid_ai_response_format',
        status: input.status,
      });
    } catch (error) {
      this.logger.warn({
        message: 'AI recovery guidance fallback triggered',
        adapter: AIRecoveryGuidanceGenerator.name,
        reason: 'ai_engine_error',
        status: input.status,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return this.buildFallbackGuidance(input);
  }

  private parseGuidance(text: string): RecoveryGuidanceOutput | null {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    try {
      const parsed = JSON.parse(
        jsonMatch[0],
      ) as Partial<RecoveryGuidanceOutput>;
      if (
        typeof parsed.suggestedReply === 'string' &&
        typeof parsed.suggestedNextAction === 'string'
      ) {
        return {
          suggestedReply: parsed.suggestedReply.trim(),
          suggestedNextAction: parsed.suggestedNextAction.trim(),
        };
      }
    } catch {
      return null;
    }

    return null;
  }

  private buildFallbackGuidance(
    input: RecoveryGuidanceInput,
  ): RecoveryGuidanceOutput {
    if (input.status === 'PROMISE_TO_PAY') {
      const chargeReference = input.chargeTitle
        ? ` referente a ${input.chargeTitle}`
        : '';
      return {
        suggestedReply: `Perfeito, obrigado pela confirmação${chargeReference}. Vou deixar registrado e fico acompanhando por aqui. Se precisar, posso te reenviar o link.`,
        suggestedNextAction:
          'Confirmar o prazo prometido e acompanhar a liquidação do pagamento.',
      };
    }

    if (input.status === 'NO_RESPONSE') {
      return {
        suggestedReply:
          'Oi, passando para retomar esse atendimento com você. Se quiser, posso te explicar o valor pendente ou reenviar a cobrança por aqui.',
        suggestedNextAction:
          'Reengajar o cliente e validar se ainda existe objeção ou necessidade de novo link.',
      };
    }

    const chargeReference = input.chargeTitle
      ? ` sobre ${input.chargeTitle}`
      : input.chargeDescription
        ? ` sobre ${input.chargeDescription}`
        : '';
    return {
      suggestedReply: `Sem problema, eu posso te ajudar a encontrar a melhor forma de regularizar${chargeReference}. Se quiser, te explico o valor ou te reenvio o link agora.`,
      suggestedNextAction:
        'Esclarecer a objeção do cliente e conduzir para pagamento ou condição de fechamento.',
    };
  }
}
