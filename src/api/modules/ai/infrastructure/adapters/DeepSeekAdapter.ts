import {
  AIRequest,
  AIResponse,
  IAIEngine,
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

@Injectable()
export class DeepSeekAdapter implements IAIEngine {
  private readonly logger = new Logger(DeepSeekAdapter.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly httpTimeoutMs: number;
  private readonly estimatedUsdPerMillionTokens: number;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('DEEPSEEK_API_KEY') || '';
    this.baseUrl =
      this.configService.get<string>('DEEPSEEK_BASE_URL') ||
      'https://api.deepseek.com/v1';
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
        'ai.provider': 'deepseek-chat',
      },
      async () => this.executeChatCompletion(request),
    );
  }

  private async executeChatCompletion(request: AIRequest): Promise<AIResponse> {
    const tenantId = request.trace?.tenantId ?? '';

    try {
      const messages = [
        { role: 'system', content: request.systemPrompt },
        ...request.contextHistory.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        { role: 'user', content: request.userMessage },
      ];

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: 'deepseek-chat',
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
      const tokensUsed: number = response.data.usage?.total_tokens || 0;
      const aiResponse: AIResponse = {
        text: choice.message.content,
        tokensUsed,
        confidence: 1.0,
        finishReason:
          choice.finish_reason === 'stop'
            ? 'stop'
            : choice.finish_reason === 'length'
              ? 'length'
              : 'error',
        intent: 'GENERAL',
        sentiment: 'NEUTRAL',
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
