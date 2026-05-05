export interface IAIEngine {
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
