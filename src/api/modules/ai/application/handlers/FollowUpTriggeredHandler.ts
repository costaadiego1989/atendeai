import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { IEventBus, EVENT_BUS } from '@shared/infrastructure/event-bus';
import { IProcessAIResponseUseCase } from '../use-cases/interfaces/IProcessAIResponseUseCase';
import {
  FollowUpTriggeredEvent,
  FollowUpTriggeredPayload,
} from '../../../messaging/application/events/FollowUpTriggeredEvent';

@Injectable()
export class FollowUpTriggeredHandler implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    @Inject(IProcessAIResponseUseCase)
    private readonly processAIResponseUseCase: IProcessAIResponseUseCase,
  ) { }

  onModuleInit() {
    this.eventBus.subscribe<FollowUpTriggeredEvent>(
      'messaging.follow-up-triggered',
      async (event) => {
        await this.handle(event.payload);
      },
      { consumerName: 'ai-follow-up-triggered' },
    );
  }

  private async handle(payload: FollowUpTriggeredPayload) {
    await this.processAIResponseUseCase.execute({
      conversationId: payload.conversationId,
      tenantId: payload.tenantId,
      contactId: payload.contactId,
      content: {
        type: 'TEXT',
        text: this.buildFollowUpPrompt(payload),
      },
    });
  }

  private buildFollowUpPrompt(payload: FollowUpTriggeredPayload): string {
    const intelligence = payload.intelligence;
    const contextLines = [
      `Follow-up de ${payload.interval}`,
      intelligence?.summary ? `Resumo: ${intelligence.summary}` : null,
      intelligence?.sentiment ? `Sentimento: ${intelligence.sentiment}` : null,
      intelligence?.tags?.length ? `Tags: ${intelligence.tags.join(', ')}` : null,
      intelligence?.interests?.length
        ? `Interesses: ${intelligence.interests.join(', ')}`
        : null,
      intelligence?.lossReason ? `Possivel motivo de perda: ${intelligence.lossReason}` : null,
      intelligence?.nextStep ? `Proximo passo sugerido: ${intelligence.nextStep}` : null,
    ].filter(Boolean);

    return [
      '[SISTEMA: Enviar uma mensagem de follow-up contextual para este cliente.]',
      ...contextLines,
      'Regras: seja breve, util e respeitoso; não pressione; faca uma unica pergunta clara para retomar a conversa.',
    ].join('\n');
  }
}
