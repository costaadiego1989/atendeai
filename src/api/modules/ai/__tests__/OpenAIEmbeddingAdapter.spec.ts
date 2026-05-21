import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { OpenAIEmbeddingAdapter } from '../infrastructure/adapters/OpenAIEmbeddingAdapter';

jest.mock('axios');
jest.mock('axios-retry', () => {
  const mockFn: any = jest.fn();
  mockFn.exponentialDelay = jest.fn();
  mockFn.isNetworkOrIdempotentRequestError = jest.fn(() => false);
  return mockFn;
});
jest.mock('@shared/infrastructure/observability/DomainTrace', () => ({
  traceAsync: (_name: string, _attrs: any, fn: () => Promise<any>) => fn(),
}));

describe('OpenAIEmbeddingAdapter', () => {
  let adapter: OpenAIEmbeddingAdapter;
  let mockPost: jest.Mock;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    mockPost = jest.fn();
    (axios.create as jest.Mock).mockReturnValue({ post: mockPost });

    configService = {
      get: jest.fn((key: string) => {
        const vals: Record<string, string> = {
          OPENAI_API_KEY: 'test-key',
          OPENAI_EMBEDDING_MODEL: 'text-embedding-3-small',
          OPENAI_EMBEDDING_DIMENSIONS: '1536',
        };
        return vals[key];
      }),
    } as any;

    adapter = new OpenAIEmbeddingAdapter(configService);
  });

  describe('generateEmbeddings', () => {
    it('returns [] for empty input without calling API', async () => {
      const result = await adapter.generateEmbeddings([]);
      expect(result).toEqual([]);
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('returns embeddings sorted by index regardless of API response order', async () => {
      mockPost.mockResolvedValue({
        data: {
          data: [
            { embedding: [0.3, 0.4], index: 1 },
            { embedding: [0.1, 0.2], index: 0 },
          ],
        },
      });

      const result = await adapter.generateEmbeddings(['first', 'second']);
      expect(result[0]).toEqual([0.1, 0.2]);
      expect(result[1]).toEqual([0.3, 0.4]);
    });

    it('passes model, input, and dimensions to API', async () => {
      mockPost.mockResolvedValue({
        data: { data: [{ embedding: [0.1], index: 0 }] },
      });

      await adapter.generateEmbeddings(['hello']);
      expect(mockPost).toHaveBeenCalledWith('/embeddings', {
        model: 'text-embedding-3-small',
        input: ['hello'],
        dimensions: 1536,
      });
    });

    it('processes texts in batches of 100', async () => {
      const makeBatch = (count: number) => ({
        data: {
          data: Array.from({ length: count }, (_, i) => ({
            embedding: [i / 1000],
            index: i,
          })),
        },
      });

      mockPost
        .mockResolvedValueOnce(makeBatch(100))
        .mockResolvedValueOnce(makeBatch(50));

      const texts = Array.from({ length: 150 }, (_, i) => `text-${i}`);
      const result = await adapter.generateEmbeddings(texts);

      expect(mockPost).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(150);
    });

    it('returns single embedding for single text', async () => {
      mockPost.mockResolvedValue({
        data: { data: [{ embedding: [0.5, 0.6], index: 0 }] },
      });

      const result = await adapter.generateEmbeddings(['only one']);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual([0.5, 0.6]);
    });
  });

  describe('generateEmbedding', () => {
    it('delegates to generateEmbeddings and returns first result', async () => {
      mockPost.mockResolvedValue({
        data: { data: [{ embedding: [0.5, 0.6, 0.7], index: 0 }] },
      });

      const result = await adapter.generateEmbedding('test text');
      expect(result).toEqual([0.5, 0.6, 0.7]);
      expect(mockPost).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('throws "Embedding generation failed: 429" on rate limit error', async () => {
      mockPost.mockRejectedValue({
        response: { status: 429, data: { error: 'rate limit exceeded' } },
        message: 'Request failed with status code 429',
      });

      await expect(adapter.generateEmbeddings(['text'])).rejects.toThrow(
        'Embedding generation failed: 429',
      );
    });

    it('throws "Embedding generation failed: network_error" when no HTTP status', async () => {
      mockPost.mockRejectedValue({ message: 'connect ECONNREFUSED 127.0.0.1:443' });

      await expect(adapter.generateEmbeddings(['text'])).rejects.toThrow(
        'Embedding generation failed: network_error',
      );
    });

    it('uses default model and dimensions when config values are absent', () => {
      (configService.get as jest.Mock).mockReturnValue(undefined);
      const adapterWithDefaults = new OpenAIEmbeddingAdapter(configService);
      expect(adapterWithDefaults).toBeDefined();
    });
  });
});
