import { z } from 'zod';

export interface StructuredAIRequest<T extends z.ZodType> {
  schema: T;
  systemPrompt: string;
  userMessage: string;
  contextHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
  temperature?: number;
}

export interface TextAIRequest {
  systemPrompt: string;
  userMessage: string;
  contextHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
  temperature?: number;
}

export interface IAIEngine {
  /** Structured output — validated by Zod schema, auto-retry on parse failure */
  generateStructuredResponse<T extends z.ZodType>(
    request: StructuredAIRequest<T>,
  ): Promise<z.infer<T>>;

  /** Text output — for free-form text generation */
  generateTextResponse(request: TextAIRequest): Promise<string>;

  /** @deprecated Use generateStructuredResponse or generateTextResponse */
  generateResponse(request: AIRequest): Promise<AIResponse>;
}

export interface AITraceContext {
  tenantId?: string;
  conversationId?: string;
}

export interface AIRequest {
  systemPrompt: string;
  contextHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  userMessage: string;
  maxTokens: number;
  temperature?: number;
  trace?: AITraceContext;
}

export type IntentType =
  | 'PURCHASE'
  | 'QUESTION'
  | 'COMPLAINT'
  | 'GREETING'
  | 'GENERAL';
export type SentimentType = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

export interface AIResponse {
  text: string;
  tokensUsed: number;
  confidence: number;
  finishReason: 'stop' | 'length' | 'error';
  intent?: IntentType;
  sentiment?: SentimentType;
}

export const AI_ENGINE = Symbol('AI_ENGINE');
