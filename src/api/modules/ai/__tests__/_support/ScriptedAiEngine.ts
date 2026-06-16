import {
  AIRequest,
  AIResponse,
  IAIEngine,
  IntentType,
  SentimentType,
} from '../../application/ports/IAIEngine';

/**
 * Deterministic, programmable AI engine for conversation E2E tests.
 *
 * Replaces the real DeepSeek/Claude adapter (AI_ENGINE token) so that every
 * conversational turn is fully controllable: the test scripts the exact text
 * (including action tags such as [PAYMENT_LINK:...], [SCHEDULE_SLOT:...],
 * [REPEAT_LAST_ORDER]), intent, sentiment and confidence the "LLM" returns,
 * or forces a provider failure to exercise resilience paths.
 *
 * It also records every AIRequest so tests can assert on the final system
 * prompt and user message that reached the model.
 */
export interface ScriptedTurn {
  text?: string;
  intent?: IntentType;
  sentiment?: SentimentType;
  confidence?: number;
  tokensUsed?: number;
  finishReason?: 'stop' | 'length' | 'error';
  /** When set, generateResponse rejects with this error (resilience tests). */
  throws?: Error;
}

export class ScriptedAiEngine implements IAIEngine {
  public requests: AIRequest[] = [];
  private queue: ScriptedTurn[] = [];
  private fallback: ScriptedTurn = {
    text: 'Resposta padrão do agente de testes.',
    intent: 'QUESTION',
    sentiment: 'POSITIVE',
    confidence: 0.95,
    tokensUsed: 16,
    finishReason: 'stop',
  };

  /** Clears recorded requests and any queued turns. Call in beforeEach. */
  reset(): void {
    this.requests = [];
    this.queue = [];
  }

  /** Queue the next response(s). Consumed FIFO, one per generateResponse call. */
  enqueue(...turns: ScriptedTurn[]): this {
    this.queue.push(...turns);
    return this;
  }

  /** Force the next generateResponse call to throw (provider offline / 5xx). */
  failNext(error: Error): this {
    this.queue.push({ throws: error });
    return this;
  }

  /** Override the default response used when the queue is empty. */
  setFallback(turn: ScriptedTurn): this {
    this.fallback = { ...this.fallback, ...turn };
    return this;
  }

  get lastRequest(): AIRequest | undefined {
    return this.requests[this.requests.length - 1];
  }

  async generateResponse(request: AIRequest): Promise<AIResponse> {
    this.requests.push(request);

    const turn = this.queue.shift() ?? this.fallback;

    if (turn.throws) {
      throw turn.throws;
    }

    return {
      text: turn.text ?? this.fallback.text ?? '',
      tokensUsed: turn.tokensUsed ?? this.fallback.tokensUsed ?? 16,
      confidence: turn.confidence ?? this.fallback.confidence ?? 0.95,
      finishReason: turn.finishReason ?? 'stop',
      intent: turn.intent ?? this.fallback.intent ?? 'QUESTION',
      sentiment: turn.sentiment ?? this.fallback.sentiment ?? 'POSITIVE',
    };
  }
}
