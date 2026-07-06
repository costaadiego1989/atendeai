import { FakeChatModel } from '../FakeChatModel';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
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
});
