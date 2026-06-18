import {
  AIRequest,
  AIResponse,
  IAIEngine,
  IntentType,
  SentimentType,
} from '@modules/ai/application/ports/IAIEngine';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { traceAsync } from '@shared/infrastructure/observability/DomainTrace';
import { trace } from '@opentelemetry/api';

/**
 * Structured output shape requested from the model.
 * The LLM is instructed to return this JSON inside its text reply.
 * We parse the fenced ```json ... ``` block if present, otherwise fall back
 * to the plain text and apply heuristic classification.
 */
interface ClassifiedResponse {
  reply: string;
  confidence: number; // 0.0 – 1.0 — model's self-assessed confidence
  intent: IntentType; // PURCHASE | QUESTION | COMPLAINT | GREETING | GENERAL
  sentiment: SentimentType; // POSITIVE | NEUTRAL | NEGATIVE
}

const CLASSIFICATION_SYSTEM_ADDENDUM = `

---
INSTRUCOES DE FORMATO DE RESPOSTA (OBRIGATÓRIO):
Você DEVE responder com um bloco JSON válido no seguinte formato exato, sem texto fora do JSON:
{
  "reply": "<sua resposta ao cliente aqui>",
  "confidence": <número de 0.0 a 1.0 indicando sua confiança na resposta>,
  "intent": "<PURCHASE | QUESTION | COMPLAINT | GREETING | GENERAL — baseado na mensagem do usuário>",
  "sentiment": "<POSITIVE | NEUTRAL | NEGATIVE — sentimento detectado na mensagem do usuário>"
}
Não inclua texto, markdown ou explicações fora do objeto JSON.`;

@Injectable()
export class DeepSeekAdapter implements IAIEngine {
  private readonly logger = new Logger(DeepSeekAdapter.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly httpTimeoutMs: number;
  private readonly estimatedUsdPerMillionTokens: number;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('DEEPSEEK_API_KEY') || '';
    this.baseUrl =
      this.configService.get<string>('DEEPSEEK_BASE_URL') ||
      'https://api.deepseek.com/v1';
    this.model =
      this.configService.get<string>('DEEPSEEK_MODEL') || 'deepseek-chat';
    const rawTimeout = Number(
      this.configService.get<string>('DEEPSEEK_HTTP_TIMEOUT_MS'),
    );
    this.httpTimeoutMs =
      Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : 120_000;
    const rawPrice = Number(
      this.configService.get<string>('AI_ESTIMATED_USD_PER_1M_TOKENS'),
    );
    this.estimatedUsdPerMillionTokens =
      Number.isFinite(rawPrice) && rawPrice >= 0 ? rawPrice : 0;
  }

  async generateResponse(request: AIRequest): Promise<AIResponse> {
    const tenantId = request.trace?.tenantId ?? '';
    const conversationId = request.trace?.conversationId ?? '';

    return traceAsync(
      'ai.DeepSeekAdapter.generateResponse',
      {
        'tenant.id': tenantId,
        'ai.conversation_id': conversationId,
        'ai.provider': this.model,
      },
      async () => this.executeChatCompletion(request),
    );
  }

  private async executeChatCompletion(request: AIRequest): Promise<AIResponse> {
    const tenantId = request.trace?.tenantId ?? '';

    try {
      // Append the classification instruction to the system prompt so the model
      // returns reply + confidence + intent + sentiment as a single JSON object.
      const systemPromptWithClassification =
        request.systemPrompt + CLASSIFICATION_SYSTEM_ADDENDUM;

      const messages = [
        { role: 'system', content: systemPromptWithClassification },
        ...request.contextHistory.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        { role: 'user', content: request.userMessage },
      ];

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: this.model,
          messages,
          max_tokens: request.maxTokens || 1000,
          temperature: request.temperature || 0.7,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: this.httpTimeoutMs,
        },
      );

      const choice = response.data.choices[0];
      const rawContent: string = choice.message.content ?? '';
      const tokensUsed: number = response.data.usage?.total_tokens || 0;
      const finishReason: AIResponse['finishReason'] =
        choice.finish_reason === 'stop'
          ? 'stop'
          : choice.finish_reason === 'length'
            ? 'length'
            : 'error';

      // Parse the classified JSON response; fall back to heuristics on malformed output.
      const classified = this.parseClassifiedResponse(
        rawContent,
        request.userMessage,
        finishReason,
      );

      const aiResponse: AIResponse = {
        text: classified.reply,
        tokensUsed,
        confidence: classified.confidence,
        finishReason,
        intent: classified.intent,
        sentiment: classified.sentiment,
      };

      const span = trace.getActiveSpan();
      if (span) {
        span.setAttribute('ai.tokens.total', tokensUsed);
        span.setAttribute(
          'ai.tokens.prompt',
          response.data.usage?.prompt_tokens ?? 0,
        );
        span.setAttribute(
          'ai.tokens.completion',
          response.data.usage?.completion_tokens ?? 0,
        );
        span.setAttribute(
          'ai.estimated.usd.per.1m.config',
          String(this.estimatedUsdPerMillionTokens),
        );
        span.setAttribute(
          'ai.estimated.usd.rounded6',
          this.formatEstimatedUsd(tokensUsed),
        );
      }

      return aiResponse;
    } catch (error: unknown) {
      const err = error as {
        message?: string;
        code?: string;
        response?: { data?: unknown; status?: number };
      };
      const status = err.response?.status;
      const detailRaw = err.response?.data ?? err.message ?? error;
      const detail =
        typeof detailRaw === 'object'
          ? JSON.stringify(detailRaw)
          : String(detailRaw);

      this.logger.error(
        `[DeepSeekAdapter] falha tenantId=${tenantId || 'na'} axiosStatus=${status ?? 'na'} code=${err.code ?? 'na'} detail=${detail.slice(0, 2000)}`,
      );

      throw new InternalServerErrorException('Failed to generate AI response');
    }
  }

  /**
   * Attempts to parse the model's structured JSON response.
   * The model is instructed to return the full JSON object with reply/confidence/
   * intent/sentiment fields.  If parsing fails (model ignored instructions),
   * we fall back to heuristic classification of the raw text.
   */
  private parseClassifiedResponse(
    rawContent: string,
    userMessage: string,
    finishReason: AIResponse['finishReason'],
  ): ClassifiedResponse {
    const trimmed = rawContent.trim();

    // Try to extract a JSON object from a fenced code block first, then bare JSON.
    const jsonCandidates: string[] = [];
    const fencedMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
    if (fencedMatch) {
      jsonCandidates.push(fencedMatch[1].trim());
    }
    // Try the entire content as JSON
    jsonCandidates.push(trimmed);
    // Try to find a leading { ... } block
    const braceMatch = /(\{[\s\S]*\})/s.exec(trimmed);
    if (braceMatch) {
      jsonCandidates.push(braceMatch[1]);
    }

    for (const candidate of jsonCandidates) {
      try {
        const parsed = JSON.parse(candidate) as Partial<ClassifiedResponse>;
        if (typeof parsed.reply === 'string' && parsed.reply.length > 0) {
          return {
            reply: parsed.reply,
            confidence: this.clampConfidence(parsed.confidence, finishReason),
            intent: this.validateIntent(parsed.intent),
            sentiment: this.validateSentiment(parsed.sentiment),
          };
        }
      } catch {
        // continue to next candidate
      }
    }

    // Fallback: model did not return structured JSON — use raw content as reply
    // and derive classification heuristically.
    this.logger.warn(
      '[DeepSeekAdapter] model did not return structured JSON — applying heuristic classification',
    );
    return this.heuristicClassify(rawContent, userMessage, finishReason);
  }

  /**
   * Heuristic classification used when the model ignores the JSON format
   * instruction.  Better than hardcoded constants: at minimum the handoff policy
   * now has a chance to trigger on complaints/negative sentiment.
   */
  private heuristicClassify(
    replyText: string,
    userMessage: string,
    finishReason: AIResponse['finishReason'],
  ): ClassifiedResponse {
    const msg = userMessage.toLowerCase();

    // Intent detection
    let intent: IntentType = 'GENERAL';
    if (
      /(comprar|preço|valor|quanto custa|pedido|checkout|produto|catálogo|catalogo)/i.test(
        msg,
      )
    ) {
      intent = 'PURCHASE';
    } else if (
      /(problema|reclamação|reclamacao|errado|quebrado|defeito|não funciona|nao funciona|insatisfeito|irritado|raiva|péssimo|pessimo)/i.test(
        msg,
      )
    ) {
      intent = 'COMPLAINT';
    } else if (
      /(como|o que|quando|onde|por que|porque|qual|quais|me explica|me diz|me conta)/i.test(
        msg,
      )
    ) {
      intent = 'QUESTION';
    } else if (
      /(oi|olá|ola|bom dia|boa tarde|boa noite|hey|hi|hello)/i.test(msg)
    ) {
      intent = 'GREETING';
    }

    // Sentiment detection
    let sentiment: SentimentType = 'NEUTRAL';
    if (
      /(ótimo|otimo|excelente|obrigado|parabéns|parabens|perfeito|adorei|gostei|feliz|satisfeito)/i.test(
        msg,
      )
    ) {
      sentiment = 'POSITIVE';
    } else if (
      /(problema|raiva|irritado|odeio|péssimo|pessimo|horrível|horrivel|absurdo|inaceitável|inaceitavel|reclamação|reclamacao)/i.test(
        msg,
      )
    ) {
      sentiment = 'NEGATIVE';
    }

    // Confidence: lower when finishReason is length/error or when reply is short
    const baseConfidence = finishReason === 'stop' ? 0.8 : 0.4;
    const confidence =
      replyText.trim().length < 20
        ? Math.min(baseConfidence, 0.5)
        : baseConfidence;

    return {
      reply: replyText,
      confidence,
      intent,
      sentiment,
    };
  }

  private clampConfidence(
    raw: unknown,
    finishReason: AIResponse['finishReason'],
  ): number {
    const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
    if (!Number.isFinite(n)) {
      // Model omitted the field — derive from finishReason
      return finishReason === 'stop' ? 0.85 : 0.4;
    }
    return Math.min(1.0, Math.max(0.0, n));
  }

  private validateIntent(raw: unknown): IntentType {
    const valid: IntentType[] = [
      'PURCHASE',
      'QUESTION',
      'COMPLAINT',
      'GREETING',
      'GENERAL',
    ];
    return valid.includes(raw as IntentType) ? (raw as IntentType) : 'GENERAL';
  }

  private validateSentiment(raw: unknown): SentimentType {
    const valid: SentimentType[] = ['POSITIVE', 'NEUTRAL', 'NEGATIVE'];
    return valid.includes(raw as SentimentType)
      ? (raw as SentimentType)
      : 'NEUTRAL';
  }

  private formatEstimatedUsd(tokensUsed: number): string {
    if (
      tokensUsed <= 0 ||
      this.estimatedUsdPerMillionTokens <= 0 ||
      !Number.isFinite(tokensUsed)
    ) {
      return '0';
    }
    const usd = (tokensUsed / 1_000_000) * this.estimatedUsdPerMillionTokens;
    return usd.toFixed(6);
  }
}
