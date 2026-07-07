import { FakeChatModel, QueuedToolCall } from '../FakeChatModel';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { AIMessageChunk } from '@langchain/core/messages';
import { z } from 'zod';

describe('FakeChatModel', () => {
  let model: FakeChatModel;

  beforeEach(() => {
    model = new FakeChatModel({});
  });

  it('returns queued text response', async () => {
    model.queueResponse('Hello world');

    const result = await model.invoke([new HumanMessage('Hi')]);

    expect(result.content).toBe('Hello world');
  });

  it('returns queued JSON as string', async () => {
    const obj = { name: 'João', age: 30 };
    model.queueJson(obj);

    const result = await model.invoke([new HumanMessage('Extract')]);

    expect(JSON.parse(result.content as string)).toEqual(obj);
  });

  it('returns responses in order', async () => {
    model.queueResponse('first');
    model.queueResponse('second');
    model.queueResponse('third');

    const r1 = await model.invoke([new HumanMessage('1')]);
    const r2 = await model.invoke([new HumanMessage('2')]);
    const r3 = await model.invoke([new HumanMessage('3')]);

    expect(r1.content).toBe('first');
    expect(r2.content).toBe('second');
    expect(r3.content).toBe('third');
  });

  it('throws when no more responses queued', async () => {
    model.queueResponse('only one');
    await model.invoke([new HumanMessage('1')]);

    await expect(model.invoke([new HumanMessage('2')])).rejects.toThrow(
      /no more queued responses/,
    );
  });

  it('tracks call count and messages', async () => {
    model.queueResponse('resp1');
    model.queueResponse('resp2');

    await model.invoke([new SystemMessage('sys'), new HumanMessage('msg1')]);
    await model.invoke([new HumanMessage('msg2')]);

    expect(model.callCount).toBe(2);
    expect(model.calls[0]).toHaveLength(2);
    expect(model.calls[1]).toHaveLength(1);
  });

  it('works with withStructuredOutput and Zod schema', async () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });

    model.queueJson({ name: 'Maria', age: 25 });

    const structured = model.withStructuredOutput(schema);
    const result = await structured.invoke([new HumanMessage('Extract')]);

    expect(result).toEqual({ name: 'Maria', age: 25 });
  });

  it('resets state correctly', async () => {
    model.queueResponse('old');
    await model.invoke([new HumanMessage('x')]);

    model.reset();
    model.queueResponse('new');

    const result = await model.invoke([new HumanMessage('y')]);

    expect(result.content).toBe('new');
    expect(model.callCount).toBe(1);
  });

  describe('tool call support', () => {
    it('queueToolCall returns AIMessageChunk with tool_calls', async () => {
      model.queueToolCall('generate_payment_link', {
        productName: 'Corte',
        value: 50,
      });

      const result = await model.invoke([new HumanMessage('gerar link')]);

      expect(result.tool_calls).toHaveLength(1);
      expect(result.tool_calls![0].name).toBe('generate_payment_link');
      expect(result.tool_calls![0].args).toEqual({
        productName: 'Corte',
        value: 50,
      });
      expect(result.content).toBe('');
    });

    it('queueToolCalls returns multiple tool_calls', async () => {
      const calls: QueuedToolCall[] = [
        { name: 'generate_payment_link', args: { productName: 'A', value: 10 } },
        { name: 'trigger_automation', args: { automationId: 'abc-123' } },
      ];
      model.queueToolCalls(calls);

      const result = await model.invoke([new HumanMessage('do both')]);

      expect(result.tool_calls).toHaveLength(2);
      expect(result.tool_calls![0].name).toBe('generate_payment_link');
      expect(result.tool_calls![1].name).toBe('trigger_automation');
    });

    it('queueResponseWithTools returns text + tool_calls', async () => {
      model.queueResponseWithTools('Gerando seu link...', [
        { name: 'generate_payment_link', args: { productName: 'X', value: 99 } },
      ]);

      const result = await model.invoke([new HumanMessage('link')]);

      expect(result.content).toBe('Gerando seu link...');
      expect(result.tool_calls).toHaveLength(1);
      expect(result.tool_calls![0].name).toBe('generate_payment_link');
      expect(result.tool_calls![0].args).toEqual({
        productName: 'X',
        value: 99,
      });
    });

    it('interleaves text and tool responses', async () => {
      model.queueResponse('just text');
      model.queueToolCall('schedule_slot', { date: '2026-07-10' });
      model.queueResponse('more text');

      const r1 = await model.invoke([new HumanMessage('1')]);
      const r2 = await model.invoke([new HumanMessage('2')]);
      const r3 = await model.invoke([new HumanMessage('3')]);

      expect(r1.content).toBe('just text');
      expect(r1.tool_calls).toHaveLength(0);
      expect(r2.tool_calls).toHaveLength(1);
      expect(r2.tool_calls![0].name).toBe('schedule_slot');
      expect(r3.content).toBe('more text');
    });
  });
});
