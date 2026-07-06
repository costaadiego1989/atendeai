import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ChatModelFactory } from '../ChatModelFactory';

describe('ChatModelFactory', () => {
  let factory: ChatModelFactory;
  let configService: ConfigService;

  const defaultEnv: Record<string, string> = {
    OPENAI_API_KEY: 'sk-test-key',
    OPENAI_BASE_URL: 'https://openrouter.ai/api/v1',
    OPENROUTER_DEFAULT_MODEL: 'deepseek/deepseek-chat',
    OPENROUTER_FALLBACK_MODEL: 'anthropic/claude-haiku-4-5-20251001',
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ChatModelFactory,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => defaultEnv[key]),
          },
        },
      ],
    }).compile();

    factory = module.get(ChatModelFactory);
    configService = module.get(ConfigService);
  });

  describe('createPrimary', () => {
    it('returns ChatOpenAI instance with correct model from config', () => {
      const model = factory.createPrimary();

      expect(model).toBeDefined();
      expect(model.model).toBe('deepseek/deepseek-chat');
    });

    it('applies override for temperature', () => {
      const model = factory.createPrimary({ temperature: 0.2 });

      expect(model.temperature).toBe(0.2);
    });

    it('uses default timeout of 120_000ms', () => {
      const model = factory.createPrimary();

      expect(model.timeout).toBe(120_000);
    });
  });

  describe('createFallback', () => {
    it('returns ChatOpenAI instance with fallback model', () => {
      const model = factory.createFallback();

      expect(model).toBeDefined();
      expect(model.model).toBe('anthropic/claude-haiku-4-5-20251001');
    });
  });

  describe('validation', () => {
    it('throws when OPENAI_API_KEY is missing', async () => {
      const module = await Test.createTestingModule({
        providers: [
          ChatModelFactory,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'OPENAI_API_KEY') return undefined;
                return defaultEnv[key];
              }),
            },
          },
        ],
      }).compile();

      const factoryMissingKey = module.get(ChatModelFactory);

      expect(() => factoryMissingKey.createPrimary()).toThrow(
        'OPENAI_API_KEY is not configured',
      );
    });
  });
});
