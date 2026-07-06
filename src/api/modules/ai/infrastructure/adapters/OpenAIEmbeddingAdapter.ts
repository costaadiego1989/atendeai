import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import { IEmbeddingProvider } from '@modules/ai/application/ports/IEmbeddingProvider';
import { traceAsync } from '@shared/infrastructure/observability/DomainTrace';

const BATCH_SIZE = 100;

@Injectable()
export class OpenAIEmbeddingAdapter implements IEmbeddingProvider {
  private readonly logger = new Logger(OpenAIEmbeddingAdapter.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly dimensions: number;
  private readonly httpClient;

  constructor(private readonly configService: ConfigService) {
    this.apiKey =
      this.configService.get<string>('OFICIAL_OPENAI_API_KEY') || '';
    this.model =
      this.configService.get<string>('OPENAI_EMBEDDING_MODEL') ||
      'text-embedding-3-small';
    this.dimensions =
      Number(this.configService.get<string>('OPENAI_EMBEDDING_DIMENSIONS')) ||
      1536;

    this.httpClient = axios.create({
      baseURL: 'https://api.openai.com/v1',
      timeout: 30_000,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    axiosRetry(this.httpClient, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) =>
        axiosRetry.isNetworkOrIdempotentRequestError(error) ||
        error.response?.status === 429,
    });
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const results = await this.generateEmbeddings([text]);
    return results[0];
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    return traceAsync(
      'ai.OpenAIEmbeddingAdapter.generateEmbeddings',
      {
        'embedding.model': this.model,
        'embedding.input_count': String(texts.length),
      },
      async () => this.executeBatchEmbeddings(texts),
    );
  }

  private async executeBatchEmbeddings(texts: string[]): Promise<number[][]> {
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const embeddings = await this.callEmbeddingsAPI(batch);
      allEmbeddings.push(...embeddings);
    }

    return allEmbeddings;
  }

  private async callEmbeddingsAPI(inputs: string[]): Promise<number[][]> {
    try {
      const response = await this.httpClient.post('/embeddings', {
        model: this.model,
        input: inputs,
        dimensions: this.dimensions,
      });

      const data = response.data.data as Array<{
        embedding: number[];
        index: number;
      }>;

      // Sort by index to ensure order matches input
      data.sort((a, b) => a.index - b.index);

      return data.map((item) => item.embedding);
    } catch (error: unknown) {
      const err = error as {
        message?: string;
        response?: { data?: unknown; status?: number };
      };
      const status = err.response?.status;
      const detail = err.response?.data
        ? JSON.stringify(err.response.data).slice(0, 500)
        : (err.message ?? 'unknown');

      this.logger.error(
        `[OpenAIEmbeddingAdapter] failed status=${status ?? 'na'} detail=${detail}`,
      );

      throw new Error(
        `Embedding generation failed: ${status ?? 'network_error'}`,
      );
    }
  }
}
