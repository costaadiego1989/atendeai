import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { InternalServerErrorException } from '@nestjs/common';
import { DeepSeekAdapter } from '../infrastructure/adapters/DeepSeekAdapter';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
}));

describe('DeepSeekAdapter', () => {
  let adapter: DeepSeekAdapter;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    jest.clearAllMocks();

    configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === 'DEEPSEEK_API_KEY') return 'deepseek-key';
        if (key === 'DEEPSEEK_BASE_URL') return 'https://deepseek.test/v1';
        return defaultValue;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    adapter = new DeepSeekAdapter(configService);
  });

  it('should send the prompt payload and map the response successfully', async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        choices: [
          {
            message: { content: 'Resposta de vendas' },
            finish_reason: 'stop',
          },
        ],
        usage: {
          total_tokens: 321,
        },
      },
    });

    const result = await adapter.generateResponse({
      systemPrompt: 'Sistema',
      userMessage: 'Quero saber o valor',
      contextHistory: [{ role: 'user', content: 'Oi' }],
      maxTokens: 600,
      temperature: 0.5,
    });

    expect(axios.post).toHaveBeenCalledWith(
      'https://deepseek.test/v1/chat/completions',
      expect.objectContaining({
        model: 'deepseek-chat',
        max_tokens: 600,
        temperature: 0.5,
        messages: [
          { role: 'system', content: 'Sistema' },
          { role: 'user', content: 'Oi' },
          { role: 'user', content: 'Quero saber o valor' },
        ],
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer deepseek-key',
          'Content-Type': 'application/json',
        }),
      }),
    );
    expect(result).toEqual({
      text: 'Resposta de vendas',
      tokensUsed: 321,
      confidence: 1,
      finishReason: 'stop',
      intent: 'GENERAL',
      sentiment: 'NEUTRAL',
    });
  });

  it('should normalize provider timeouts as internal server errors', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    (axios.post as jest.Mock).mockRejectedValue(new Error('timeout exceeded'));

    await expect(
      adapter.generateResponse({
        systemPrompt: 'Sistema',
        userMessage: 'Oi',
        contextHistory: [],
        maxTokens: 300,
      }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    consoleErrorSpy.mockRestore();
  });

  it('should normalize provider HTTP errors as internal server errors', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    (axios.post as jest.Mock).mockRejectedValue({
      response: {
        data: {
          error: 'rate_limit_exceeded',
        },
      },
      message: 'Request failed with status 429',
    });

    await expect(
      adapter.generateResponse({
        systemPrompt: 'Sistema',
        userMessage: 'Oi',
        contextHistory: [],
        maxTokens: 300,
      }),
    ).rejects.toThrow('Failed to generate AI response');

    consoleErrorSpy.mockRestore();
  });
});
