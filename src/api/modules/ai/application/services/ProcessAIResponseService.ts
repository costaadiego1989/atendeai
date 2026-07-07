import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import { AI_ENGINE, IAIEngine, AIResponse } from '../ports/IAIEngine';
import { ConversationClassificationSchema } from '../../domain/schemas/ConversationClassificationSchema';
import type { BaseAgentResponse } from '../../domain/agents/schemas/BaseAgentResponseSchema';
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
import { OutputGuardrailService } from './OutputGuardrailService';
import {
  ToolExecutionService,
  ToolExecutionContext,
} from './ToolExecutionService';
import {
  IConversationPhaseStore,
  CONVERSATION_PHASE_STORE,
} from '../../infrastructure/persistence/RedisConversationPhaseStore';
import type { BusinessType } from '../../domain/value-objects/ConversationPhase';
import {
  AgentRouter,
  AgentRoutingResult,
} from '../../domain/agents/AgentRouter';

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
    private readonly outputGuardrail: OutputGuardrailService,
    private readonly toolExecutionService: ToolExecutionService,
    private readonly agentRouter: AgentRouter,
    @Optional()
    @Inject(CONVERSATION_PHASE_STORE)
    private readonly phaseStore?: IConversationPhaseStore,
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

    const userMessage = await this.userMessageResolver.resolve(input);

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

    const quotaResult = await this.quotaGuard.check(input);
    if (!quotaResult.canProceed) {
      return {
        success: false,
        error: quotaResult.error,
        message: quotaResult.message,
      };
    }

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
      await this.advanceCommerceConversationUseCase.execute({
        tenantId: input.tenantId,
        branchId: resolvedBranchId,
        conversationId: input.conversationId,
        contactId: input.contactId,
        businessType: tenant.businessType,
        userMessage,
      });

      const businessType = (tenant.businessType as BusinessType) || 'generic';
      const phaseState = this.phaseStore
        ? await this.phaseStore.get(input.conversationId)
        : null;
      const currentPhase = phaseState?.currentPhase;

      const routing: AgentRoutingResult = this.agentRouter.route({
        businessType,
        currentPhase: currentPhase ?? null,
        lastIntent: null,
      });
      const selectedAgent = routing.agent;

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
          currentPhase,
          businessType,
          agentPromptTemplate: selectedAgent.systemPromptTemplate,
        });

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

      const classified = await traceAsync(
        'ai.ProcessAIResponseService.generateAssistantTurn',
        {
          'tenant.id': input.tenantId,
          'ai.conversation_id': input.conversationId,
          'ai.agent_id': selectedAgent.id,
          'ai.routing_reason': routing.reason,
        },
        async () =>
          this.aiEngine.generateStructuredResponse({
            schema: selectedAgent.responseSchema,
            systemPrompt,
            userMessage,
            contextHistory,
            maxTokens: tenant.aiConfig?.maxTokensPerResponse || 1000,
            temperature: 0.7,
          }),
      );

      const agentResponse = classified as BaseAgentResponse;

      const response: AIResponse = {
        text: agentResponse.reply,
        tokensUsed: 0,
        confidence: agentResponse.confidence,
        finishReason: 'stop',
        intent: agentResponse.intent,
        sentiment: agentResponse.sentiment,
      };

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

      const guardrailResult = this.outputGuardrail.evaluate(response.text);
      if (!guardrailResult.safe) {
        this.logger.warn(
          `output_guardrail_violations conversation=${input.conversationId} count=${guardrailResult.violations.length}`,
        );
      }
      const guardedText = guardrailResult.sanitized;

      const toolContext: ToolExecutionContext = {
        tenantId: input.tenantId,
        contactId: input.contactId,
        conversationId: input.conversationId,
        branchId: resolvedBranchId,
      };

      let toolResultText = '';
      const rawToolCalls = (agentResponse as any).tool_calls as
        | Array<{ name: string; args: Record<string, unknown> }>
        | undefined;
      if (rawToolCalls && rawToolCalls.length > 0) {
        for (const tc of rawToolCalls) {
          const toolResult = await this.toolExecutionService.execute(
            { name: tc.name, args: tc.args },
            toolContext,
          );
          if (toolResult.success) {
            toolResultText += toolResult.data
              ? ` ${JSON.stringify(toolResult.data)}`
              : '';
          } else if (toolResult.fallbackMessage) {
            toolResultText += ` ${toolResult.fallbackMessage}`;
          }
        }
      }

      const processedText = await this.responseProcessor.process(guardedText, {
        tenantId: tenant.id.toString(),
        branchId: resolvedBranchId,
        contactId: input.contactId,
        conversationId: input.conversationId,
      });

      const { finalText: cleanedText, dispatchedCount } =
        await this.automationDispatcher.extractAndDispatch({
          tenantId: input.tenantId,
          contactId: input.contactId,
          conversationId: input.conversationId,
          text: processedText,
        });

      const finalText =
        (cleanedText.trim() || processedText) +
        (toolResultText ? toolResultText.trim() : '');

      if (this.phaseStore && agentResponse.phase) {
        const transitioned = await this.phaseStore.transition(
          input.conversationId,
          agentResponse.phase,
          businessType,
        );
        if (!transitioned) {
          this.logger.debug(
            `phase_transition_invalid conversation=${input.conversationId} from=${currentPhase} to=${agentResponse.phase}`,
          );
        }
      }

      if (
        ragCacheEnabled &&
        queryEmbedding &&
        response.finishReason === 'stop'
      ) {
        await this.ragResponseCache!.cacheResponse(
          input.tenantId,
          queryEmbedding,
          finalText,
        );
      }

      await this.turnPersistence.persist({
        input,
        sessionId: aiSession.id,
        processedText: finalText,
        aiResponse: response,
        diagnostics: {
          ...diagnostics,
          ragCacheHit: false,
          automationsDispatched: dispatchedCount,
          agentId: selectedAgent.id,
          routingReason: routing.reason,
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
