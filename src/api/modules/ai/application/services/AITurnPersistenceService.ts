import { Inject, Injectable, Logger } from '@nestjs/common';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import {
  CHAT_HISTORY_REPOSITORY,
  IChatHistoryRepository,
} from '../ports/IChatHistoryRepository';
import { AISessionService } from './AISessionService';
import { AIResponseGeneratedIntegrationEvent } from '../integration-events/publishers/AIIntegrationEvents';
import { ProcessAIResponseInput } from '../use-cases/interfaces/IProcessAIResponseUseCase';

export interface PersistTurnInput {
  input: ProcessAIResponseInput;
  sessionId: string;
  processedText: string;
  aiResponse: {
    tokensUsed?: number;
    intent?: string;
    sentiment?: string;
    confidence?: number;
  };
  diagnostics: Record<string, unknown>;
  userMessage: string;
}

@Injectable()
export class AITurnPersistenceService {
  private readonly logger = new Logger(AITurnPersistenceService.name);

  constructor(
    @Inject(CHAT_HISTORY_REPOSITORY)
    private readonly chatHistoryRepository: IChatHistoryRepository,
    private readonly aiSessionService: AISessionService,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
  ) {}

  async persist(params: PersistTurnInput): Promise<void> {
    const { input, sessionId, processedText, aiResponse, diagnostics, userMessage } = params;

    await this.chatHistoryRepository.saveMessage(input.conversationId, {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    });
    await this.chatHistoryRepository.saveMessage(input.conversationId, {
      role: 'assistant',
      content: processedText,
      timestamp: new Date(),
    });

    await this.aiSessionService.recordMessage(
      input.tenantId,
      sessionId,
      'user',
      userMessage,
    );
    await this.aiSessionService.recordMessage(
      input.tenantId,
      sessionId,
      'assistant',
      processedText,
      aiResponse.tokensUsed,
      { ...diagnostics, engineResponse: aiResponse },
    );

    await this.eventBus.publish(
      new AIResponseGeneratedIntegrationEvent({
        conversationId: input.conversationId,
        tenantId: input.tenantId,
        contactId: input.contactId,
        aiSessionId: sessionId,
        response: { type: 'TEXT', text: processedText },
        intent: aiResponse.intent || 'GENERAL',
        sentiment: aiResponse.sentiment || 'NEUTRAL',
        confidence: aiResponse.confidence ?? 0,
        tokensUsed: aiResponse.tokensUsed ?? 0,
      }),
    );
  }
}
