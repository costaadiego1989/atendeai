import { Injectable } from '@nestjs/common';
import { StructuredLogEmitter } from '@shared/infrastructure/observability/StructuredLogEmitter';
import {
  IMessagingGateway,
  MessagingContent,
  MessagingProviderConfig,
} from '../../domain/ports/IMessagingGateway';

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
}

export interface SendWithRetryResult {
  success: boolean;
  messageId?: string;
  error?: string;
  attempts: number;
  exhaustedRetries: boolean;
}

@Injectable()
export class OutboundMessageRetryService {
  private static readonly DEFAULT_MAX_RETRIES = 3;
  private static readonly DEFAULT_BASE_DELAY_MS = 1000;

  constructor(private readonly structuredLog: StructuredLogEmitter) {}

  async sendWithRetry(
    gateway: IMessagingGateway,
    config: MessagingProviderConfig,
    to: string,
    content: MessagingContent,
    context: { messageId: string; tenantId: string; conversationId: string },
    options?: RetryOptions,
  ): Promise<SendWithRetryResult> {
    const maxRetries =
      options?.maxRetries ?? OutboundMessageRetryService.DEFAULT_MAX_RETRIES;
    const baseDelayMs =
      options?.baseDelayMs ?? OutboundMessageRetryService.DEFAULT_BASE_DELAY_MS;

    let lastError: string | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await gateway.sendMessage(config, to, content);

        if (result.success) {
          if (attempt > 0) {
            this.structuredLog.emit({
              level: 'info',
              event: 'messaging.outbound.retry_succeeded',
              message: `Mensagem enviada com sucesso apos ${attempt} tentativa(s)`,
              tenantId: context.tenantId,
              attributes: {
                message_id: context.messageId,
                conversation_id: context.conversationId,
                attempt: String(attempt),
                provider: config.provider,
              },
            });
          }
          return {
            success: true,
            messageId: result.messageId,
            attempts: attempt + 1,
            exhaustedRetries: false,
          };
        }

        // Gateway returned { success: false } — check if retryable
        lastError = result.error ?? 'Gateway returned failure';

        if (!this.isRetryableError(result.error)) {
          this.structuredLog.emit({
            level: 'warn',
            event: 'messaging.outbound.non_retryable_error',
            message: `Erro nao retentavel: ${lastError}`,
            tenantId: context.tenantId,
            attributes: {
              message_id: context.messageId,
              conversation_id: context.conversationId,
              attempt: String(attempt),
              provider: config.provider,
              error: lastError,
            },
          });
          return {
            success: false,
            error: lastError,
            attempts: attempt + 1,
            exhaustedRetries: false,
          };
        }

        if (attempt < maxRetries) {
          const delay = this.calculateDelay(attempt, baseDelayMs);
          this.structuredLog.emit({
            level: 'warn',
            event: 'messaging.outbound.retry_scheduled',
            message: `Tentativa ${attempt + 1} falhou, retentando em ${delay}ms`,
            tenantId: context.tenantId,
            attributes: {
              message_id: context.messageId,
              conversation_id: context.conversationId,
              attempt: String(attempt),
              next_delay_ms: String(delay),
              provider: config.provider,
              error: lastError,
            },
          });
          await this.sleep(delay);
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        lastError = errorMessage;

        if (!this.isRetryableException(error)) {
          this.structuredLog.emit({
            level: 'warn',
            event: 'messaging.outbound.non_retryable_exception',
            message: `Excecao nao retentavel: ${errorMessage}`,
            tenantId: context.tenantId,
            attributes: {
              message_id: context.messageId,
              conversation_id: context.conversationId,
              attempt: String(attempt),
              provider: config.provider,
              error: errorMessage,
            },
          });
          return {
            success: false,
            error: errorMessage,
            attempts: attempt + 1,
            exhaustedRetries: false,
          };
        }

        if (attempt < maxRetries) {
          const delay = this.calculateDelay(attempt, baseDelayMs);
          this.structuredLog.emit({
            level: 'warn',
            event: 'messaging.outbound.retry_scheduled',
            message: `Tentativa ${attempt + 1} lancou excecao, retentando em ${delay}ms`,
            tenantId: context.tenantId,
            attributes: {
              message_id: context.messageId,
              conversation_id: context.conversationId,
              attempt: String(attempt),
              next_delay_ms: String(delay),
              provider: config.provider,
              error: errorMessage,
            },
          });
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted
    this.structuredLog.emit({
      level: 'error',
      event: 'messaging.outbound.retries_exhausted',
      message: `Todas as ${maxRetries + 1} tentativas falharam`,
      tenantId: context.tenantId,
      attributes: {
        message_id: context.messageId,
        conversation_id: context.conversationId,
        max_retries: String(maxRetries),
        provider: config.provider,
        last_error: lastError ?? 'unknown',
      },
    });

    return {
      success: false,
      error: lastError,
      attempts: maxRetries + 1,
      exhaustedRetries: true,
    };
  }

  /**
   * Exponential backoff with jitter:
   * delay = baseDelayMs * 2^attempt + random(0, 100)
   */
  private calculateDelay(attempt: number, baseDelayMs: number): number {
    const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
    const jitter = Math.floor(Math.random() * 100);
    return exponentialDelay + jitter;
  }

  /**
   * Determines if a gateway error string indicates a retryable condition.
   * Retries on: timeout, rate limit (429), 5xx server errors.
   * Does NOT retry on: 4xx client errors (except 429), validation errors.
   */
  private isRetryableError(error?: string): boolean {
    if (!error) return true; // Unknown error — retry by default

    const lowerError = error.toLowerCase();

    // Timeout errors
    if (
      lowerError.includes('timeout') ||
      lowerError.includes('timed out') ||
      lowerError.includes('etimedout') ||
      lowerError.includes('econnreset') ||
      lowerError.includes('econnrefused')
    ) {
      return true;
    }

    // Rate limit (429)
    if (lowerError.includes('429') || lowerError.includes('rate limit')) {
      return true;
    }

    // 5xx server errors
    if (/\b5\d{2}\b/.test(error)) {
      return true;
    }

    // 4xx client errors (except 429) — not retryable
    if (/\b4\d{2}\b/.test(error) && !lowerError.includes('429')) {
      return false;
    }

    // Validation errors — not retryable
    if (
      lowerError.includes('validation') ||
      lowerError.includes('invalid') ||
      lowerError.includes('malformed')
    ) {
      return false;
    }

    // Default: retry on unknown errors
    return true;
  }

  /**
   * Determines if a thrown exception is retryable.
   */
  private isRetryableException(error: unknown): boolean {
    if (error instanceof Error) {
      return this.isRetryableError(error.message);
    }
    return true;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
