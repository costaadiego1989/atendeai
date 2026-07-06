import { z } from 'zod';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { StructuredOutputChainFactory } from '../StructuredOutputChainFactory';
import { StructuredOutputParseError } from '../../errors';

describe('StructuredOutputChainFactory', () => {
  let factory: StructuredOutputChainFactory;
  let mockStructuredModel: { invoke: jest.Mock };
  let mockModel: BaseChatModel;

  const testSchema = z.object({
    name: z.string(),
    age: z.number(),
  });

  beforeEach(() => {
    mockStructuredModel = {
      invoke: jest.fn(),
    };
    mockModel = {
      withStructuredOutput: jest.fn().mockReturnValue(mockStructuredModel),
    } as unknown as BaseChatModel;

    factory = new StructuredOutputChainFactory();
  });

  it('should return Zod-validated object when model returns valid JSON', async () => {
    const expected = { name: 'John', age: 30 };
    mockStructuredModel.invoke.mockResolvedValue(expected);

    const chain = factory.create({
      schema: testSchema,
      model: mockModel,
      systemPrompt: 'You are a helpful assistant',
    });

    const result = await chain.invoke({ userMessage: 'Tell me about John' });

    expect(result).toEqual(expected);
    expect(mockStructuredModel.invoke).toHaveBeenCalledTimes(1);
  });

  it('should retry on first failure and return on second success', async () => {
    const expected = { name: 'Jane', age: 25 };
    mockStructuredModel.invoke
      .mockRejectedValueOnce(new Error('Parse error'))
      .mockResolvedValueOnce(expected);

    const chain = factory.create({
      schema: testSchema,
      model: mockModel,
      systemPrompt: 'You are a helpful assistant',
    });

    const result = await chain.invoke({ userMessage: 'Tell me about Jane' });

    expect(result).toEqual(expected);
    expect(mockStructuredModel.invoke).toHaveBeenCalledTimes(2);
  });

  it('should throw StructuredOutputParseError when all attempts fail', async () => {
    mockStructuredModel.invoke.mockRejectedValue(new Error('Parse error'));

    const chain = factory.create({
      schema: testSchema,
      model: mockModel,
      systemPrompt: 'You are a helpful assistant',
    });

    await expect(
      chain.invoke({ userMessage: 'Fail please' }),
    ).rejects.toThrow(StructuredOutputParseError);

    // default maxRetries = 2, so 3 total attempts
    expect(mockStructuredModel.invoke).toHaveBeenCalledTimes(3);
  });

  it('should respect maxRetries config', async () => {
    mockStructuredModel.invoke.mockRejectedValue(new Error('Parse error'));

    const chain = factory.create({
      schema: testSchema,
      model: mockModel,
      systemPrompt: 'You are a helpful assistant',
      maxRetries: 4,
    });

    await expect(
      chain.invoke({ userMessage: 'Fail please' }),
    ).rejects.toThrow(StructuredOutputParseError);

    // maxRetries = 4, so 5 total attempts
    expect(mockStructuredModel.invoke).toHaveBeenCalledTimes(5);
  });

  it('should pass system prompt and user message correctly to model', async () => {
    const expected = { name: 'Test', age: 1 };
    mockStructuredModel.invoke.mockResolvedValue(expected);

    const chain = factory.create({
      schema: testSchema,
      model: mockModel,
      systemPrompt: 'Be concise',
    });

    await chain.invoke({ userMessage: 'Extract data' });

    const callArgs = mockStructuredModel.invoke.mock.calls[0][0];
    expect(callArgs[0]).toBeInstanceOf(SystemMessage);
    expect(callArgs[0].content).toBe('Be concise');
    expect(callArgs[1]).toBeInstanceOf(HumanMessage);
    expect(callArgs[1].content).toBe('Extract data');
  });

  it('should include context history in messages', async () => {
    const expected = { name: 'Context', age: 99 };
    mockStructuredModel.invoke.mockResolvedValue(expected);

    const chain = factory.create({
      schema: testSchema,
      model: mockModel,
      systemPrompt: 'System',
    });

    await chain.invoke({
      userMessage: 'Final question',
      contextHistory: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
      ],
    });

    const callArgs = mockStructuredModel.invoke.mock.calls[0][0];
    expect(callArgs).toHaveLength(4); // system + 2 history + human
    expect(callArgs[0].content).toBe('System');
    expect(callArgs[1]).toBeInstanceOf(HumanMessage);
    expect(callArgs[1].content).toBe('Hello');
    expect(callArgs[3]).toBeInstanceOf(HumanMessage);
    expect(callArgs[3].content).toBe('Final question');
  });
});
