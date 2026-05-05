import { Inject, Injectable } from '@nestjs/common';
import { AI_ENGINE, IAIEngine } from '@modules/ai/application/ports/IAIEngine';
import {
  IRecoveryOutreachGenerator,
  RecoveryOutreachInput,
} from '../../application/ports/IRecoveryOutreachGenerator';

@Injectable()
export class AIRecoveryOutreachGenerator implements IRecoveryOutreachGenerator {
  constructor(
    @Inject(AI_ENGINE)
    private readonly aiEngine: IAIEngine,
  ) { }

  async generate(input: RecoveryOutreachInput): Promise<string> {
    try {
      const response = await this.aiEngine.generateResponse({
        systemPrompt: `Voce escreve a primeira abordagem de recovery por WhatsApp.
Retorne APENAS o texto da mensagem final, sem markdown e sem explicações.

Regras:
- Tom educado, humano e comercial.
- Não seja agressivo nem ameaçador.
- Convide o cliente a regularizar por aqui.
- Deixe claro qual cobrança esta sendo tratada quando esse contexto existir.
- Se houver valor em aberto, cite de forma natural.
- Se houver prazo, use isso para gerar urgencia leve.
- Mensagem curta, pronta para envio no WhatsApp.`,
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
          assignedTags: input.assignedTags,
        }),
        maxTokens: 180,
        temperature: 0.3,
      });

      const normalizedText = response.text.trim();
      if (normalizedText) {
        return normalizedText;
      }
    } catch {
      // Falls back to deterministic outreach below.
    }

    return this.buildFallback(input);
  }

  private buildFallback(input: RecoveryOutreachInput): string {
    const companySnippet = input.debtorCompanyName
      ? ` da ${input.debtorCompanyName}`
      : '';
    const chargeSnippet = input.chargeTitle
      ? ` referente a ${input.chargeTitle}`
      : input.chargeDescription
        ? ` referente a ${input.chargeDescription}`
        : '';
    const amountSnippet = input.amountDue
      ? ` Identifiquei uma pendencia de R$ ${input.amountDue.replace('.', ',')}.`
      : ' Identifiquei uma pendência em aberto.';

    return `Oi, ${input.debtorName}. Tudo bem? Vi uma pendência${companySnippet}${chargeSnippet}.${amountSnippet} Posso te ajudar a regularizar por aqui de forma simples. Se quiser, eu te explico as opções agora.`;
  }
}
