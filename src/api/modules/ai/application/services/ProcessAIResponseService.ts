import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import { AI_ENGINE, IAIEngine } from '../ports/IAIEngine';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import {
  AIQuotaDeniedIntegrationEvent,
  AIResponseFailedIntegrationEvent,
  AIResponseGeneratedIntegrationEvent,
  AISafetyBlockedIntegrationEvent,
  AIEscalationRequestedIntegrationEvent,
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
import { ICheckQuotaUseCase } from '../../../billing/application/use-cases/interfaces/ICheckQuotaUseCase';
import { UsageType } from '../../../billing/application/use-cases/interfaces/IRecordUsageUseCase';
import { AIResponseProcessor } from './AIResponseProcessor';
import { HumanHandoffPolicy } from './HumanHandoffPolicy';
import {
  ADVANCE_COMMERCE_CONVERSATION,
  IAdvanceCommerceConversation,
} from '../ports/IAdvanceCommerceConversation';
import { AISessionService } from './AISessionService';
import { AIContextAggregator } from './AIContextAggregator';
import {
  CONTACT_REPOSITORY,
  IContactRepository,
} from '@modules/contact/domain/repositories/IContactRepository';
import { TenantAgentRuleService } from '@modules/agent-rules/application/services/TenantAgentRuleService';
import { MediaUnderstandingService } from './MediaUnderstandingService';
import { traceAsync } from '@shared/infrastructure/observability/DomainTrace';
import { AiSafetyGate } from './AiSafetyGate';
import { Tenant } from '../../../tenant/domain/entities/Tenant';
import {
  IRAGResponseCache,
  RAG_RESPONSE_CACHE,
} from '../ports/IRAGResponseCache';
import {
  EMBEDDING_PROVIDER,
  IEmbeddingProvider,
} from '../ports/IEmbeddingProvider';

@Injectable()
export class ProcessAIResponseService {
  private readonly logger = new Logger(ProcessAIResponseService.name);

  private static readonly RAG_CACHE_THRESHOLD = 0.95;
  /** Maximum number of past messages sent as context to the LLM.
   *  Caps the token spend for long-running conversations without requiring
   *  a full token-counting library.  Configurable via AI_CONTEXT_WINDOW_TURNS
   *  env var (each turn = 1 user + 1 assistant message → 2 entries).
   *  Default: 20 turns = 40 messages.
   */
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
    @Inject(ICheckQuotaUseCase)
    private readonly checkQuotaUseCase: ICheckQuotaUseCase,
    private readonly responseProcessor: AIResponseProcessor,
    private readonly humanHandoffPolicy: HumanHandoffPolicy,
    @Inject(ADVANCE_COMMERCE_CONVERSATION)
    private readonly advanceCommerceConversationUseCase: IAdvanceCommerceConversation,
    private readonly aiSessionService: AISessionService,
    private readonly contextAggregator: AIContextAggregator,
    @Inject(CONTACT_REPOSITORY)
    private readonly contactRepository: IContactRepository,
    private readonly tenantAgentRuleService: TenantAgentRuleService,
    private readonly aiSafetyGate: AiSafetyGate,
    @Optional()
    private readonly mediaUnderstandingService?: MediaUnderstandingService,
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

    const userMessage = await this.resolveUserMessage(input);

    const safetyDecision = this.aiSafetyGate.evaluateUserMessage(userMessage);
    if (safetyDecision.blocked) {
      await this.publishSafetyBlocked(input, safetyDecision.pattern);
      return {
        success: false,
        error: 'SAFETY_BLOCKED',
        message: 'A mensagem nao pode ser processada neste momento.',
      };
    }

    const quotaCheck = await this.checkQuotaUseCase.execute({
      tenantId: input.tenantId,
      type: UsageType.AI_TOKEN,
    });

    if (!quotaCheck.canProceed) {
      await this.publishQuotaDenied(input, quotaCheck);
      if (quotaCheck.status === 'NO_SUBSCRIPTION') {
        await this.publishFallbackFailed(
          input,
          'Estou em configuração. Tente novamente em breve.',
        );
        return {
          success: false,
          error: 'NO_SUBSCRIPTION',
          message: 'Conta em configuração. Tente novamente em instantes.',
        };
      }
      if (quotaCheck.status !== 'ACTIVE') {
        await this.publishFallbackFailed(
          input,
          'Assinatura inativa. Entre em contato com o suporte.',
        );
        return {
          success: false,
          error: 'SUBSCRIPTION_INACTIVE',
          message: 'Assinatura inativa.',
        };
      }
      await this.publishFallbackFailed(
        input,
        'Limite de uso atingido. Tente novamente mais tarde.',
      );
      return {
        success: false,
        error: 'QUOTA_EXCEEDED',
        message: 'Limite de uso atingido.',
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
    // Token-budget windowing: slice to the most recent N messages so we don't
    // blow the context window on long conversations (audit finding: lrange 0 -1
    // sends the full 30-day history).  We keep whole turns (user+assistant pairs)
    // by taking an even number of tail messages.
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
      // Commerce advancement runs INSIDE the try so any state-machine/checkout
      // failure degrades to the friendly fallback instead of escaping unhandled.
      await this.advanceCommerceConversationUseCase.execute({
        tenantId: input.tenantId,
        branchId: resolvedBranchId,
        conversationId: input.conversationId,
        contactId: input.contactId,
        businessType: tenant.businessType,
        userMessage,
      });

      const { systemPrompt, diagnostics } =
        await this.contextAggregator.aggregate(
          tenant,
          input.conversationId,
          userMessage,
          contextHistory.length === 0,
        );

      let promptWithAgentRule = await this.applyMessagingAgentRule(
        input.tenantId,
        systemPrompt,
        input.moduleId || 'messaging',
        resolvedBranchId,
      );

      if (input.contextHints?.length) {
        promptWithAgentRule =
          promptWithAgentRule +
          '\n\n[OPÇÕES PRÉ-DEFINIDAS DO WIDGET — use como contexto de intenção do visitante]:\n' +
          input.contextHints.map((h) => `- ${h}`).join('\n');
      }

      promptWithAgentRule =
        this.aiSafetyGate.appendPlatformLimits(promptWithAgentRule);

      // RAG cache check: only when PDF context was used
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

          await this.persistTurn(
            input,
            aiSession.id,
            cachedResponse,
            {
              tokensUsed: 0,
              intent: 'RAG_CACHED',
              sentiment: 'NEUTRAL',
              confidence: 1,
            },
            { ...diagnostics, ragCacheHit: true },
            userMessage,
          );

          return { success: true };
        }
      }

      const response = await traceAsync(
        'ai.ProcessAIResponseService.generateAssistantTurn',
        {
          'tenant.id': input.tenantId,
          'ai.conversation_id': input.conversationId,
        },
        async () =>
          this.aiEngine.generateResponse({
            systemPrompt: promptWithAgentRule,
            userMessage,
            contextHistory,
            maxTokens: tenant.aiConfig?.maxTokensPerResponse || 1000,
            trace: {
              tenantId: input.tenantId,
              conversationId: input.conversationId,
            },
          }),
      );

      const handoffDecision = this.humanHandoffPolicy.evaluate({
        userMessage,
        response,
        confidenceThreshold: tenant.aiConfig?.confidenceThreshold || 0.7,
      });

      if (handoffDecision.shouldHandoff) {
        return this.handleHandoff(
          input,
          tenant,
          response,
          handoffDecision,
          aiSession.id,
          userMessage,
        );
      }

      const processedText = await this.responseProcessor.process(
        response.text,
        {
          tenantId: tenant.id.toString(),
          branchId: resolvedBranchId,
          contactId: input.contactId,
          conversationId: input.conversationId,
        },
      );

      // Cache the response if RAG was involved and response completed normally
      if (
        ragCacheEnabled &&
        queryEmbedding &&
        response.finishReason === 'stop'
      ) {
        await this.ragResponseCache!.cacheResponse(
          input.tenantId,
          queryEmbedding,
          processedText,
        );
      }

      await this.persistTurn(
        input,
        aiSession.id,
        processedText,
        response,
        { ...diagnostics, ragCacheHit: false },
        userMessage,
      );

      return { success: true };
    } catch (error: unknown) {
      return this.handleFailure(input, error);
    }
  }

  private async publishSafetyBlocked(
    input: ProcessAIResponseInput,
    matchedPattern: string,
  ) {
    await this.eventBus.publish(
      new AISafetyBlockedIntegrationEvent({
        conversationId: input.conversationId,
        tenantId: input.tenantId,
        contactId: input.contactId,
        matchedPattern,
        reason: 'USER_MESSAGE_BLOCKED',
      }),
    );
  }

  private async persistTurn(
    input: ProcessAIResponseInput,
    sessionId: string,
    processedText: string,
    aiResponse: {
      tokensUsed?: number;
      intent?: string;
      sentiment?: string;
      confidence?: number;
    },
    diagnostics: Record<string, unknown>,
    userMessage: string,
  ) {
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

  private async handleHandoff(
    input: ProcessAIResponseInput,
    tenant: Tenant,
    response: { confidence?: number; text?: string },
    decision: { reason?: string; shouldHandoff: boolean },
    sessionId: string,
    userMessage: string,
  ) {
    const escalationMessage =
      tenant.aiConfig?.escalationMessage || 'Encaminhando para um humano...';

    await this.chatHistoryRepository.saveMessage(input.conversationId, {
      role: 'assistant',
      content: escalationMessage,
      timestamp: new Date(),
    });

    await this.aiSessionService.closeSession(
      input.tenantId,
      sessionId,
      'HANDOFF',
    );

    await this.eventBus.publish(
      new AIEscalationRequestedIntegrationEvent({
        conversationId: input.conversationId,
        tenantId: input.tenantId,
        contactId: input.contactId,
        reason: decision.reason || 'HANDOFF_REQUIRED',
        confidence: response.confidence ?? 0,
        lastMessage: userMessage,
        escalationMessage,
      }),
    );

    return {
      success: false,
      error: 'HANDOFF_REQUIRED',
      message: 'Escalated to human.',
    };
  }

  private async handleFailure(input: ProcessAIResponseInput, error: unknown) {
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

  private async publishFallbackFailed(
    input: ProcessAIResponseInput,
    fallbackMessage: string,
  ) {
    await this.eventBus.publish(
      new AIResponseFailedIntegrationEvent({
        conversationId: input.conversationId,
        tenantId: input.tenantId,
        contactId: input.contactId,
        reason: 'QUOTA_DENIED',
        provider: 'internal',
        fallbackMessage,
      }),
    );
  }

  private async publishQuotaDenied(
    input: ProcessAIResponseInput,
    quotaCheck: {
      status: string;
      used: number;
      quota: number;
    },
  ) {
    await this.eventBus.publish(
      new AIQuotaDeniedIntegrationEvent({
        conversationId: input.conversationId,
        tenantId: input.tenantId,
        contactId: input.contactId,
        usageType: UsageType.AI_TOKEN,
        status: quotaCheck.status,
        used: quotaCheck.used,
        quota: quotaCheck.quota,
      }),
    );
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

  private async applyMessagingAgentRule(
    tenantId: string,
    systemPrompt: string,
    moduleId: string,
    branchId?: string | null,
  ): Promise<string> {
    try {
      const agentRule = await this.tenantAgentRuleService.getRule(
        tenantId,
        moduleId,
        'SYSTEM',
        tenantId,
        branchId,
      );

      const customPrompt = agentRule?.isActive
        ? agentRule.customPrompt?.trim()
        : '';
      if (!customPrompt) {
        return systemPrompt;
      }

      const scopeLabel =
        agentRule?.branchId && !agentRule?.inheritedFromTenant
          ? 'DA FILIAL'
          : 'DO TENANT';

      if (agentRule?.fallbackToGlobal === false) {
        return [
          systemPrompt,
          `[ATENCAO: AS DIRETRIZES ${scopeLabel} ABAIXO DEVEM TER PRIORIDADE SOBRE O TOM PADRAO.]`,
          `[DIRETRIZES PERSONALIZADAS DE CONVERSAS]:`,
          customPrompt,
        ].join('\n\n');
      }

      return [
        systemPrompt,
        `[DIRETRIZES PERSONALIZADAS DE CONVERSAS ${scopeLabel}]:`,
        customPrompt,
      ].join('\n\n');
    } catch (e: unknown) {
      this.logger.warn(
        `apply_messaging_agent_rule_failed tenant=${tenantId} module=${moduleId} branch=${branchId ?? 'none'} detail=${e instanceof Error ? e.message : String(e)}`,
      );
      return systemPrompt;
    }
  }

  private toUserMessage(content: ProcessAIResponseInput['content']): string {
    const text = content.text?.trim();
    const type = content.type?.toUpperCase();

    if (!type || type === 'TEXT') {
      return text || '';
    }

    const labels: Record<string, string> = {
      IMAGE: 'imagem',
      AUDIO: 'audio',
      VIDEO: 'video',
      DOCUMENT: 'documento',
    };
    const label = labels[type] || 'arquivo';
    const parts = [`Cliente enviou ${label} pelo WhatsApp.`];

    if (text) {
      parts.push(`Mensagem: ${text}`);
    }
    if (content.url) {
      parts.push(`Arquivo: ${content.url}`);
    }

    return parts.join('\n');
  }

  private async resolveUserMessage(
    input: ProcessAIResponseInput,
  ): Promise<string> {
    const type = input.content.type?.toUpperCase();
    const isMedia = ['IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT'].includes(
      type ?? '',
    );

    if (!isMedia || !input.content.url || !this.mediaUnderstandingService) {
      return this.toUserMessage(input.content);
    }

    return this.mediaUnderstandingService.buildAiMessage({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      type: type as 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT',
      url: input.content.url,
      text: input.content.text,
      mimeType: input.content.mimeType,
    });
  }
}
