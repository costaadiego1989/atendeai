import { z } from 'zod';
import { ToolCallingChainFactory, ToolDefinition } from '../ToolCallingChainFactory';
import { FakeChatModel } from '../../testing/FakeChatModel';

describe('ToolCallingChainFactory', () => {
  let factory: ToolCallingChainFactory;
  let model: FakeChatModel;

  const tools: ToolDefinition[] = [
    {
      name: 'generate_payment_link',
      description: 'Generate a payment link',
      schema: z.object({
        productName: z.string(),
        value: z.number(),
      }),
    },
    {
      name: 'schedule_slot',
      description: 'Schedule an appointment slot',
      schema: z.object({
        date: z.string(),
        professionalId: z.string().optional(),
      }),
    },
  ];

  beforeEach(() => {
    factory = new ToolCallingChainFactory();
    model = new FakeChatModel({});
  });

  it('returns typed toolCall when model returns tool_call', async () => {
    model.queueToolCall('generate_payment_link', {
      productName: 'Corte',
      value: 50,
    });

    const chain = factory.create({ model, tools });
    const result = await chain.invoke({
      systemPrompt: 'You are a sales assistant',
      userMessage: 'Gerar link de pagamento',
    });

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe('generate_payment_link');
    expect(result.toolCalls[0].args).toEqual({
      productName: 'Corte',
      value: 50,
    });
    expect(result.toolCalls[0].id).toBeDefined();
  });

  it('returns empty toolCalls when model returns text only', async () => {
    model.queueResponse('Posso ajudar com algo mais?');

    const chain = factory.create({ model, tools });
    const result = await chain.invoke({
      systemPrompt: 'Assistant',
      userMessage: 'Obrigado',
    });

    expect(result.textResponse).toBe('Posso ajudar com algo mais?');
    expect(result.toolCalls).toHaveLength(0);
  });

  it('returns multiple tool_calls', async () => {
    model.queueToolCalls([
      { name: 'generate_payment_link', args: { productName: 'A', value: 10 } },
      { name: 'schedule_slot', args: { date: '2026-07-10' } },
    ]);

    const chain = factory.create({ model, tools });
    const result = await chain.invoke({
      systemPrompt: 'Assistant',
      userMessage: 'Do both',
    });

    expect(result.toolCalls).toHaveLength(2);
    expect(result.toolCalls[0].name).toBe('generate_payment_link');
    expect(result.toolCalls[1].name).toBe('schedule_slot');
  });

  it('returns text alongside tool_calls (mixed response)', async () => {
    model.queueResponseWithTools('Gerando link...', [
      { name: 'generate_payment_link', args: { productName: 'X', value: 99 } },
    ]);

    const chain = factory.create({ model, tools });
    const result = await chain.invoke({
      systemPrompt: 'Assistant',
      userMessage: 'Gerar',
    });

    expect(result.textResponse).toBe('Gerando link...');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].args).toEqual({ productName: 'X', value: 99 });
  });

  it('passes context history to model', async () => {
    model.queueResponse('Ok entendi');

    const chain = factory.create({ model, tools });
    await chain.invoke({
      systemPrompt: 'System',
      userMessage: 'Quero agendar',
      contextHistory: [
        { role: 'user', content: 'Olá' },
        { role: 'assistant', content: 'Oi! Como posso ajudar?' },
      ],
    });

    // 1 system + 2 history + 1 user = 4 messages
    expect(model.calls[0]).toHaveLength(4);
  });
});
