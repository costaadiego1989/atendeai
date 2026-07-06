import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';

export interface ModelConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 120_000;

@Injectable()
export class ChatModelFactory {
  constructor(private readonly config: ConfigService) {}

  createPrimary(overrides?: Partial<ModelConfig>): ChatOpenAI {
    const model =
      overrides?.model ??
      this.config.get<string>('OPENROUTER_DEFAULT_MODEL') ??
      'deepseek/deepseek-chat';

    return this.buildModel(model, overrides);
  }

  createFallback(overrides?: Partial<ModelConfig>): ChatOpenAI {
    const model =
      overrides?.model ??
      this.config.get<string>('OPENROUTER_FALLBACK_MODEL') ??
      'anthropic/claude-haiku-4-5-20251001';

    return this.buildModel(model, overrides);
  }

  private buildModel(
    model: string,
    overrides?: Partial<ModelConfig>,
  ): ChatOpenAI {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const baseURL = this.config.get<string>('OPENAI_BASE_URL');

    return new ChatOpenAI({
      model,
      apiKey,
      configuration: { baseURL },
      temperature: overrides?.temperature ?? 0.7,
      maxTokens: overrides?.maxTokens,
      timeout: overrides?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });
  }
}
