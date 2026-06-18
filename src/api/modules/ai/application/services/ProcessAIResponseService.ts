import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import { AI_ENGINE, IAIEngine } from '../ports/IAIEngine';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import {
  AISafetyBlockedIntegrationEvent,
  AIResponseFailedIntegrationEvent,
} from '../integration-events/publishers/AIIntegrationEvents';
import {
  ProcessAIResponseInput,
  ProcessAIResponseOutput,
} from '../use-cases/interfaces/IProcessAIResponseUseCase';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '../../../tenant/domain/repositories/ITenantRepository';
import {
  CHAT_HISTORY_REPOSITORY,
  IChatHistoryRepository,
} from '../ports/IChatHistoryRepository';
import { AIResponseProcessor } from './AIResponseProcessor';
import { HumanHandoffPolicy } from './HumanHandoffPolicy';
import {
  ADVANCE_COMMERCE_CONVERSATION,
  IAdvanceCommerceConversation,
} from '../ports/IAdvanceCommerceConversation';
import { AISessionService } from './AISessionService';
import {
  CONTACT_REPOSITORY,
  IContactRepository,
} from '@modules/contact/domain/repositories/IContactRepository';
import { AiSafetyGate } from './AiSafetyGate';
import { traceAsync } from '@shared/infrastructure/observability/DomainTrace';
import {
  IRAGResponseCache,
  RAG_RESPONSE_CACHE,
} from '../ports/IRAGResponseCache';
import {
  EMBEDDING_PROVIDER,
  IEmbeddingProvider,
} from '../ports/IEmbeddingProvider';

import { AIQuotaGuard } from './AIQuotaGuard';
import { AISystemPromptAssembler } from './AISystemPromptAssembler';
import { AITurnPersistenceService } from './AITurnPersistenceService';
import { AIHandoffService } from './AIHandoffService';
import { AIAutomationDispatcher } from './AIAutomationDispatcher';
import { AIUserMessageResolver } from './AIUserMessageResolver';

@Injectable()
export class ProcessAIResponseService {
  private readonly logger = new Logger(ProcessAIResponseService.name);
  private static readonly RAG_CACHE_THRESHOLD = 0.95;
  private static readonly DEFAULT_CONTEXT_WINDOW_TURNS = 20;

  constructor(
    @Inject(AI_ENGINE)
    private readonly aiEngine: IAIEngine,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: ITenantRepository,
    @Inject(CHAT_HISTORY_REPOSITORY)
    private readonly chatHistoryRepository: IChatHistoryRepository,
    private readonly responseProcessor: AIResponseProcessor,
    private readonly humanHandoffPolicy: HumanHandoffPolicy,
    @Inject(ADVANCE_COMMERCE_CONVERSATION)
    private readonly advanceCommerceConversationUseCase: IAdvanceCommerceConversation,
    private readonly aiSessionService: AISessionService,
    @Inject(CONTACT_REPOSITORY)
    private readonly contactRepository: IContactRepository,
    private readonly aiSafetyGate: AiSafetyGate,
    private readonly quotaGuard: AIQuotaGuard,
    private readonly promptAssembler: AISystemPromptAssembler,
    private readonly turnPersistence: AITurnPersistenceService,
    private readonly handoffService: AIHandoffService,
    private readonly automationDispatcher: AIAutomationDispatcher,
    private readonly userMessageResolver: AIUserMessageResolver,
    @Optional()
    @Inject(RAG_RESPONSE_CACHE)
    private readonly ragResponseCache?: IRAGResponseCache,
    @Optional()
    @Inject(EMBEDDING_PROVIDER)
    private readonly embeddingProvider?: IEmbeddingProvider,
  ) {}

  async process(
    input: ProcessAIResponseInput,
  ): Promise<ProcessAIResponseOutput> {
    return traceAsync(
      'ai.ProcessAIResponseService.process',
      {
        'tenant.id': input.tenantId,
        'ai.conversation_id': input.conversationId,
        'ai.contact_id': input.contactId,
        'ai.module_id': input.moduleId ?? 'messaging',
        'ai.branch_present': input.branchId ? 'true' : 'false',
      },
      async () => this.runPipeline(input),
    );
  }

  private async runPipeline(
    input: ProcessAIResponseInput,
  ): Promise<ProcessAIResponseOutput> {
    const tenant = await this.tenantRepository.findById(input.tenantId);
    if (!tenant) {
      throw new EntityNotFoundException('Tenant', input.tenantId);
    }

    // 1. Resolve user message (handles media types)
    const userMessage = await this.userMessageResolver.resolve(input);

    // 2. Safety gate
    const safetyDecision = this.aiSafetyGate.evaluateUserMessage(userMessage);
    if (safetyDecision.blocked) {
      await this.eventBus.publish(
        new AISafetyBlockedIntegrationEvent({
          conversationId: input.conversationId,
          tenantId: input.tenantId,
          contactId: input.contactId,
          matchedPattern: safetyDecision.pattern,
          reason: 'USER_MESSAGE_BLOCKED',
        }),
      );
      return {
        success: false,
        error: 'SAFETY_BLOCKED',
        message: 'A mensagem nao pode ser processada neste momento.',
      };
    }

    // 3. Quota check
    const quotaResult = await this.quotaGuard.check(input);
    if (!quotaResult.canProceed) {
      return {
        success: false,
        error: quotaResult.error,
        message: quotaResult.message,
      };
    }

    // 4. Session + history
    const aiSession = await this.aiSessionService.getOrCreateSession(
      input.tenantId,
      input.contactId,
      input.conversationId,
    );

    const history = await this.chatHistoryRepository.getHistory(
      input.conversationId,
    );
    const maxMessages =
      ProcessAIResponseService.DEFAULT_CONTEXT_WINDOW_TURNS * 2;
    const windowedHistory =
      history.length > maxMessages ? history.slice(-maxMessages) : history;
    const contextHistory = windowedHistory
      .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
      .map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

    const resolvedBranchId = await this.resolveBranchId(input);

    try {
      // 5. Commerce advance
      await this.advanceCommerceConversationUseCase.execute({
        tenantId: input.tenantId,
        branchId: resolvedBranchId,
        conversationId: input.conversationId,
        contactId: input.contactId,
        businessType: tenant.businessType,
        userMessage,
      });

      // 6. Assemble system prompt
      const { prompt: systemPrompt, diagnostics } =
        await this.promptAssembler.assemble({
          tenantId: input.tenantId,
          conversationId: input.conversationId,
          branchId: resolvedBranchId,
          userMessage,
          moduleId: input.moduleId || 'messaging',
          contextHints: input.contextHints,
          isFirstInteraction: contextHistory.length === 0,
          tenant,
        });

      // 7. RAG cache check
      const ragCacheEnabled =
        !!diagnostics.tenantPDFContextFound &&
        !!this.ragResponseCache &&
        !!this.embeddingProvider;

      let queryEmbedding: number[] | null = null;

      if (ragCacheEnabled) {
        queryEmbedding =
          await this.embeddingProvider!.generateEmbedding(userMessage);
        const cachedResponse = await this.ragResponseCache!.findSimilarResponse(
          input.tenantId,
          queryEmbedding,
          ProcessAIResponseService.RAG_CACHE_THRESHOLD,
        );

        if (cachedResponse) {
          this.logger.debug(
            `[RAGCache] serving cached response tenant=${input.tenantId} conversation=${input.conversationId}`,
          );

          await this.turnPersistence.persist({
            input,
            sessionId: aiSession.id,
            processedText: cachedResponse,
            aiResponse: {
              tokensUsed: 0,
              intent: 'RAG_CACHED',
              sentiment: 'NEUTRAL',
              confidence: 1,
            },
            diagnostics: { ...diagnostics, ragCacheHit: true },
            userMessage,
          });

          return { success: true };
        }
      }

      // 8. AI engine call
      const response = await traceAsync(
        'ai.ProcessAIResponseService.generateAssistantTurn',
        {
          'tenant.id': input.tenantId,
          'ai.conversation_id': input.conversationId,
        },
        async () =>
          this.aiEngine.generateResponse({
            systemPrompt,
            userMessage,
            contextHistory,
            maxTokens: tenant.aiConfig?.maxTokensPerResponse || 1000,
            trace: {
              tenantId: input.tenantId,
              conversationId: input.conversationId,
            },
          }),
      );

      // 9. Handoff policy
      const handoffDecision = this.humanHandoffPolicy.evaluate({
        userMessage,
        response,
        confidenceThreshold: tenant.aiConfig?.confidenceThreshold || 0.7,
      });

      if (handoffDecision.shouldHandoff) {
        return this.handoffService.execute({
          input,
          tenant,
          response,
          decision: handoffDecision,
          sessionId: aiSession.id,
          userMessage,
        });
      }

      // 10. Response processing + automation extraction
      const processedText = await this.responseProcessor.process(
        response.text,
        {
          tenantId: tenant.id.toString(),
          branchId: resolvedBranchId,
          contactId: input.contactId,
          conversationId: input.conversationId,
        },
      );

      const { finalText: cleanedText, dispatchedCount } =
        await this.automationDispatcher.extractAndDispatch({
          tenantId: input.tenantId,
          contactId: input.contactId,
          conversationId: input.conversationId,
          text: processedText,
        });

      const finalText = cleanedText.trim() || processedText;

      // 11. RAG cache store
      if (ragCacheEnabled && queryEmbedding && response.finishReason === 'stop') {
        await this.ragResponseCache!.cacheResponse(
          input.tenantId,
          queryEmbedding,
          finalText,
        );
      }

      // 12. Persist turn
      await this.turnPersistence.persist({
        input,
        sessionId: aiSession.id,
        processedText: finalText,
        aiResponse: response,
        diagnostics: {
          ...diagnostics,
          ragCacheHit: false,
          automationsDispatched: dispatchedCount,
        },
        userMessage,
      });

      return { success: true };
    } catch (error: unknown) {
      return this.handleFailure(input, error);
    }
  }

  private async resolveBranchId(
    input: ProcessAIResponseInput,
  ): Promise<string | null> {
    if (input.branchId) {
      return input.branchId;
    }

    try {
      const contact = await this.contactRepository.findById(
        input.tenantId,
        input.contactId,
      );
      return contact?.branchId ?? null;
    } catch (e: unknown) {
      this.logger.warn(
        `resolve_branch_id_failed tenant=${input.tenantId} contact=${input.contactId} conversation=${input.conversationId} detail=${e instanceof Error ? e.message : String(e)}`,
      );
      return null;
    }
  }

  private async handleFailure(
    input: ProcessAIResponseInput,
    error: unknown,
  ): Promise<ProcessAIResponseOutput> {
    const fallback = 'Estou com instabilidades, tente novamente em breve.';
    const msg = error instanceof Error ? error.message : String(error);

    this.logger.warn(
      `[${ProcessAIResponseService.name}] falha_ai tenant=${input.tenantId} conversation=${input.conversationId} provider=deepseek_or_downstream detail=${msg}`,
    );

    await this.eventBus.publish(
      new AIResponseFailedIntegrationEvent({
        conversationId: input.conversationId,
        tenantId: input.tenantId,
        contactId: input.contactId,
        reason: msg,
        provider: 'deepseek',
        fallbackMessage: fallback,
      }),
    );

    return { success: false, error: 'AI_PROVIDER_ERROR', message: msg };
  }
}
