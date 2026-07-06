import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import {
  ChatModelFactory,
  ModelConfig,
} from '@shared/infrastructure/langchain/models/ChatModelFactory';
import { StructuredOutputChainFactory } from '@shared/infrastructure/langchain/chains/StructuredOutputChainFactory';
import { TextOutputChainFactory } from '@shared/infrastructure/langchain/chains/TextOutputChainFactory';
import {
  AIRequest,
  AIResponse,
  IAIEngine,
  IntentType,
  SentimentType,
} from '../../application/ports/IAIEngine';
import { ConversationClassificationSchema } from '../../domain/schemas/ConversationClassificationSchema';

export interface StructuredRequest<T extends z.ZodType> {
  schema: T;
  systemPrompt: string;
  userMessage: string;
  contextHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
  temperature?: number;
}

export interface TextRequest {
  systemPrompt: string;
  userMessage: string;
  contextHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
  temperature?: number;
}

@Injectable()
export class LangChainAdapter implements IAIEngine {
  private readonly logger = new Logger(LangChainAdapter.name);

  constructor(
    private readonly modelFactory: ChatModelFactory,
    private readonly structuredChainFactory: StructuredOutputChainFactory,
    private readonly textChainFactory: TextOutputChainFactory,
  ) {}

  async generateStructuredResponse<T extends z.ZodType>(
    request: StructuredRequest<T>,
  ): Promise<z.infer<T>> {
    const overrides: Partial<ModelConfig> = {
      temperature: request.temperature,
      maxTokens: request.maxTokens,
    };

    try {
      const model = this.modelFactory.createPrimary(overrides);
      const chain = this.structuredChainFactory.create({
        schema: request.schema,
        model,
        systemPrompt: request.systemPrompt,
      });

      return await chain.invoke({
        userMessage: request.userMessage,
        contextHistory: request.contextHistory,
      });
    } catch (primaryError) {
      this.logger.warn(
        `[LangChainAdapter] primary model failed for structured output, trying fallback: ${primaryError instanceof Error ? primaryError.message : String(primaryError)}`,
      );

      const fallbackModel = this.modelFactory.createFallback(overrides);
      const fallbackChain = this.structuredChainFactory.create({
        schema: request.schema,
        model: fallbackModel,
        systemPrompt: request.systemPrompt,
        maxRetries: 1,
      });

      return await fallbackChain.invoke({
        userMessage: request.userMessage,
        contextHistory: request.contextHistory,
      });
    }
  }

  async generateTextResponse(request: TextRequest): Promise<string> {
    const overrides: Partial<ModelConfig> = {
      temperature: request.temperature,
      maxTokens: request.maxTokens,
    };

    try {
      const model = this.modelFactory.createPrimary(overrides);
      const chain = this.textChainFactory.create({ model });

      return await chain.invoke({
        systemPrompt: request.systemPrompt,
        userMessage: request.userMessage,
        contextHistory: request.contextHistory,
      });
    } catch (primaryError) {
      this.logger.warn(
        `[LangChainAdapter] primary model failed for text output, trying fallback: ${primaryError instanceof Error ? primaryError.message : String(primaryError)}`,
      );

      const fallbackModel = this.modelFactory.createFallback(overrides);
      const fallbackChain = this.textChainFactory.create({
        model: fallbackModel,
      });

      return await fallbackChain.invoke({
        systemPrompt: request.systemPrompt,
        userMessage: request.userMessage,
        contextHistory: request.contextHistory,
      });
    }
  }

  async generateResponse(request: AIRequest): Promise<AIResponse> {
    try {
      const classified = await this.generateStructuredResponse({
        schema: ConversationClassificationSchema,
        systemPrompt: request.systemPrompt,
        userMessage: request.userMessage,
        contextHistory: request.contextHistory,
        maxTokens: request.maxTokens,
        temperature: request.temperature,
      });

      return {
        text: classified.reply,
        tokensUsed: 0,
        confidence: classified.confidence,
        finishReason: 'stop',
        intent: classified.intent as IntentType,
        sentiment: classified.sentiment as SentimentType,
      };
    } catch (structuredError) {
      this.logger.warn(
        `[LangChainAdapter] structured classification failed, falling back to text: ${structuredError instanceof Error ? structuredError.message : String(structuredError)}`,
      );

      try {
        const text = await this.generateTextResponse({
          systemPrompt: request.systemPrompt,
          userMessage: request.userMessage,
          contextHistory: request.contextHistory,
          maxTokens: request.maxTokens,
          temperature: request.temperature,
        });

        return {
          text,
          tokensUsed: 0,
          confidence: 0.6,
          finishReason: 'stop',
          intent: 'GENERAL',
          sentiment: 'NEUTRAL',
        };
      } catch (textError) {
        this.logger.error(
          `[LangChainAdapter] all attempts failed: ${textError instanceof Error ? textError.message : String(textError)}`,
        );

        return {
          text: 'Estou com instabilidades, tente novamente em breve.',
          tokensUsed: 0,
          confidence: 0,
          finishReason: 'error',
          intent: 'GENERAL',
          sentiment: 'NEUTRAL',
        };
      }
    }
  }
}
