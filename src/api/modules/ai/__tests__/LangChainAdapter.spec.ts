import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { LangChainAdapter } from '../infrastructure/adapters/LangChainAdapter';
import { ChatModelFactory } from '@shared/infrastructure/langchain/models/ChatModelFactory';
import { StructuredOutputChainFactory } from '@shared/infrastructure/langchain/chains/StructuredOutputChainFactory';
import { TextOutputChainFactory } from '@shared/infrastructure/langchain/chains/TextOutputChainFactory';
import { FakeChatModel } from '@shared/infrastructure/langchain/testing/FakeChatModel';

describe('LangChainAdapter', () => {
  let adapter: LangChainAdapter;
  let primaryModel: FakeChatModel;
  let fallbackModels: FakeChatModel[];
  let fallbackCallIndex: number;

  beforeEach(async () => {
    primaryModel = new FakeChatModel({});
    fallbackModels = [];
    fallbackCallIndex = 0;

    const mockFactory = {
      createPrimary: jest.fn().mockReturnValue(primaryModel),
      createFallback: jest.fn().mockImplementation(() => {
        if (fallbackCallIndex < fallbackModels.length) {
          return fallbackModels[fallbackCallIndex++];
        }
        const m = new FakeChatModel({});
        fallbackModels.push(m);
        fallbackCallIndex++;
        return m;
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        LangChainAdapter,
        { provide: ChatModelFactory, useValue: mockFactory },
        StructuredOutputChainFactory,
        TextOutputChainFactory,
      ],
    }).compile();

    adapter = module.get(LangChainAdapter);
  });

  describe('generateStructuredResponse', () => {
    const TestSchema = z.object({
      name: z.string(),
      score: z.number().min(0).max(100),
    });

    it('returns Zod-validated object from primary model', async () => {
      primaryModel.queueJson({ name: 'Test', score: 85 });

      const result = await adapter.generateStructuredResponse({
        schema: TestSchema,
        systemPrompt: 'Extract data',
        userMessage: 'Name is Test, score 85',
      });

      expect(result).toEqual({ name: 'Test', score: 85 });
    });

    it('falls back to fallback model when primary fails', async () => {
      // Primary has no responses queued → will throw
      const fb = new FakeChatModel({});
      fb.queueJson({ name: 'Fallback', score: 70 });
      fallbackModels.push(fb);

      const result = await adapter.generateStructuredResponse({
        schema: TestSchema,
        systemPrompt: 'Extract data',
        userMessage: 'Get data',
      });

      expect(result).toEqual({ name: 'Fallback', score: 70 });
    });
  });

  describe('generateTextResponse', () => {
    it('returns text from primary model', async () => {
      primaryModel.queueResponse('Olá, como posso ajudar?');

      const result = await adapter.generateTextResponse({
        systemPrompt: 'Você é um assistente',
        userMessage: 'Oi',
      });

      expect(result).toBe('Olá, como posso ajudar?');
    });

    it('falls back to fallback model when primary fails', async () => {
      // Primary has no responses → throws
      const fb = new FakeChatModel({});
      fb.queueResponse('Resposta do fallback');
      fallbackModels.push(fb);

      const result = await adapter.generateTextResponse({
        systemPrompt: 'Sys',
        userMessage: 'Msg',
      });

      expect(result).toBe('Resposta do fallback');
    });
  });

  describe('generateResponse (bridge)', () => {
    it('returns AIResponse shape with structured classification', async () => {
      primaryModel.queueJson({
        reply: 'Posso ajudar com seu pedido',
        confidence: 0.92,
        intent: 'PURCHASE',
        sentiment: 'POSITIVE',
      });

      const result = await adapter.generateResponse({
        systemPrompt: 'Atenda o cliente',
        userMessage: 'Quero comprar',
        contextHistory: [],
        maxTokens: 500,
      });

      expect(result.text).toBe('Posso ajudar com seu pedido');
      expect(result.confidence).toBe(0.92);
      expect(result.intent).toBe('PURCHASE');
      expect(result.sentiment).toBe('POSITIVE');
      expect(result.finishReason).toBe('stop');
    });

    it('falls back to text with defaults when structured fails completely', async () => {
      // Flow: structured(primary) throws → structured(fallback) throws →
      // text(primary) throws → text(fallback) succeeds
      // Push 2 fallback models: 1st for structured (no responses → throws), 2nd for text
      const fbStructured = new FakeChatModel({});
      const fbText = new FakeChatModel({});
      fbText.queueResponse('Texto de resposta simples');
      fallbackModels.push(fbStructured, fbText);

      const result = await adapter.generateResponse({
        systemPrompt: 'Sys',
        userMessage: 'Msg',
        contextHistory: [],
        maxTokens: 500,
      });

      expect(result.text).toBe('Texto de resposta simples');
      expect(result.confidence).toBe(0.6);
      expect(result.intent).toBe('GENERAL');
      expect(result.sentiment).toBe('NEUTRAL');
    });

    it('returns error response when all attempts fail', async () => {
      // No responses queued at all → everything fails
      const result = await adapter.generateResponse({
        systemPrompt: 'Sys',
        userMessage: 'Msg',
        contextHistory: [],
        maxTokens: 500,
      });

      expect(result.finishReason).toBe('error');
      expect(result.confidence).toBe(0);
      expect(result.text).toContain('instabilidades');
    });
  });
});
