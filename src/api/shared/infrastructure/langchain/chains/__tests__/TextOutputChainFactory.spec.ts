import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { TextOutputChainFactory } from '../TextOutputChainFactory';

describe('TextOutputChainFactory', () => {
  let factory: TextOutputChainFactory;
  let mockModel: BaseChatModel;

  beforeEach(() => {
    mockModel = {
      invoke: jest.fn(),
    } as unknown as BaseChatModel;

    factory = new TextOutputChainFactory();
  });

  it('should return text content from model response', async () => {
    (mockModel.invoke as jest.Mock).mockResolvedValue({
      content: 'Hello, world!',
    });

    const chain = factory.create({ model: mockModel });

    const result = await chain.invoke({
      systemPrompt: 'You are helpful',
      userMessage: 'Say hello',
    });

    expect(result).toBe('Hello, world!');
  });

  it('should pass system prompt as SystemMessage', async () => {
    (mockModel.invoke as jest.Mock).mockResolvedValue({
      content: 'response',
    });

    const chain = factory.create({ model: mockModel });

    await chain.invoke({
      systemPrompt: 'Be concise',
      userMessage: 'Question',
    });

    const callArgs = (mockModel.invoke as jest.Mock).mock.calls[0][0];
    expect(callArgs[0]).toBeInstanceOf(SystemMessage);
    expect(callArgs[0].content).toBe('Be concise');
  });

  it('should pass context history as alternating Human/AI messages', async () => {
    (mockModel.invoke as jest.Mock).mockResolvedValue({
      content: 'final response',
    });

    const chain = factory.create({ model: mockModel });

    await chain.invoke({
      systemPrompt: 'System',
      userMessage: 'Last message',
      contextHistory: [
        { role: 'user', content: 'First question' },
        { role: 'assistant', content: 'First answer' },
        { role: 'user', content: 'Second question' },
        { role: 'assistant', content: 'Second answer' },
      ],
    });

    const callArgs = (mockModel.invoke as jest.Mock).mock.calls[0][0];
    expect(callArgs).toHaveLength(6); // system + 4 history + human
    expect(callArgs[0]).toBeInstanceOf(SystemMessage);
    expect(callArgs[1]).toBeInstanceOf(HumanMessage);
    expect(callArgs[1].content).toBe('First question');
    expect(callArgs[2]).toBeInstanceOf(AIMessage);
    expect(callArgs[2].content).toBe('First answer');
    expect(callArgs[3]).toBeInstanceOf(HumanMessage);
    expect(callArgs[3].content).toBe('Second question');
    expect(callArgs[4]).toBeInstanceOf(AIMessage);
    expect(callArgs[4].content).toBe('Second answer');
    expect(callArgs[5]).toBeInstanceOf(HumanMessage);
    expect(callArgs[5].content).toBe('Last message');
  });

  it('should work fine with empty context history', async () => {
    (mockModel.invoke as jest.Mock).mockResolvedValue({
      content: 'simple response',
    });

    const chain = factory.create({ model: mockModel });

    const result = await chain.invoke({
      systemPrompt: 'System',
      userMessage: 'Just a question',
      contextHistory: [],
    });

    expect(result).toBe('simple response');

    const callArgs = (mockModel.invoke as jest.Mock).mock.calls[0][0];
    expect(callArgs).toHaveLength(2); // system + human only
    expect(callArgs[0]).toBeInstanceOf(SystemMessage);
    expect(callArgs[1]).toBeInstanceOf(HumanMessage);
  });

  it('should work fine with undefined context history', async () => {
    (mockModel.invoke as jest.Mock).mockResolvedValue({
      content: 'no history response',
    });

    const chain = factory.create({ model: mockModel });

    const result = await chain.invoke({
      systemPrompt: 'System',
      userMessage: 'No history',
    });

    expect(result).toBe('no history response');

    const callArgs = (mockModel.invoke as jest.Mock).mock.calls[0][0];
    expect(callArgs).toHaveLength(2);
  });
});
