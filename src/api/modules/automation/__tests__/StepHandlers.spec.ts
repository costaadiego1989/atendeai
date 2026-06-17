jest.mock('node:dns/promises', () => ({
  // Default: resolve every host to a public address so non-SSRF tests pass.
  lookup: jest.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]),
}));

import { lookup } from 'node:dns/promises';
import { StepExecutionContext } from '../application/ports/IStepExecutor';
import { WaitDelayStepHandler } from '../infrastructure/workers/handlers/WaitDelayStepHandler';
import { ConditionBranchStepHandler } from '../infrastructure/workers/handlers/ConditionBranchStepHandler';
import { HttpRequestStepHandler } from '../infrastructure/workers/handlers/HttpRequestStepHandler';
import { SendMessageStepHandler } from '../infrastructure/workers/handlers/SendMessageStepHandler';
import { AddTagStepHandler } from '../infrastructure/workers/handlers/AddTagStepHandler';
import { RemoveTagStepHandler } from '../infrastructure/workers/handlers/RemoveTagStepHandler';
import { UpdateContactStepHandler } from '../infrastructure/workers/handlers/UpdateContactStepHandler';
import { AssignAgentStepHandler } from '../infrastructure/workers/handlers/AssignAgentStepHandler';
import { AiResponseStepHandler } from '../infrastructure/workers/handlers/AiResponseStepHandler';
import { CreateTaskStepHandler } from '../infrastructure/workers/handlers/CreateTaskStepHandler';

const ctx: StepExecutionContext = {
  tenantId: 'tenant-1',
  automationId: 'auto-1',
  executionId: 'exec-1',
  contactId: 'contact-1',
  variables: { name: 'João', amount: 150, message: 'oi' },
};

describe('ConditionBranchStepHandler', () => {
  const h = new ConditionBranchStepHandler();

  it('branches to trueStepId when equals matches', async () => {
    const r = await h.execute(
      { field: 'name', operator: 'equals', value: 'João', trueStepId: 'a', falseStepId: 'b' },
      ctx,
    );
    expect(r.output?.conditionMet).toBe(true);
    expect(r.nextStepId).toBe('a');
  });

  it('branches to falseStepId when not met', async () => {
    const r = await h.execute(
      { field: 'name', operator: 'equals', value: 'Maria', trueStepId: 'a', falseStepId: 'b' },
      ctx,
    );
    expect(r.nextStepId).toBe('b');
  });

  it('equals matches across types (string config vs numeric variable)', async () => {
    const r = await h.execute(
      { field: 'amount', operator: 'equals', value: '150', trueStepId: 'a', falseStepId: 'b' },
      ctx,
    );
    expect(r.output?.conditionMet).toBe(true);
    expect(r.nextStepId).toBe('a');
  });

  it('supports gt/lt/contains/exists', async () => {
    expect((await h.execute({ field: 'amount', operator: 'gt', value: 100 }, ctx)).output?.conditionMet).toBe(true);
    expect((await h.execute({ field: 'amount', operator: 'lt', value: 100 }, ctx)).output?.conditionMet).toBe(false);
    expect((await h.execute({ field: 'name', operator: 'contains', value: 'oã' }, ctx)).output?.conditionMet).toBe(true);
    expect((await h.execute({ field: 'name', operator: 'exists' }, ctx)).output?.conditionMet).toBe(true);
  });
});

describe('WaitDelayStepHandler', () => {
  it('returns waited=0 without delay', async () => {
    const r = await new WaitDelayStepHandler().execute({ delayMs: 0 }, ctx);
    expect(r).toEqual({ success: true, output: { waited: 0 } });
  });

  it('fails (does not silently proceed) when delay exceeds inline max', async () => {
    const r = await new WaitDelayStepHandler().execute(
      { delayMs: 3_600_000 },
      ctx,
    );
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/exceeds inline max/);
  });
});

describe('HttpRequestStepHandler', () => {
  const h = new HttpRequestStepHandler();
  afterEach(() => jest.restoreAllMocks());

  it('performs request and returns status', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue('{"ok":1}'),
    } as any);
    const r = await h.execute({ method: 'POST', url: 'https://x.test', body: { a: 1 } }, ctx);
    expect(r.success).toBe(true);
    expect(r.output?.httpStatus).toBe(200);
  });

  it('fails on missing url', async () => {
    const r = await h.execute({ method: 'POST' }, ctx);
    expect(r.success).toBe(false);
  });

  it('fails on HTTP error status', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue('err'),
    } as any);
    const r = await h.execute({ url: 'https://x.test' }, ctx);
    expect(r.success).toBe(false);
    expect(r.error).toBe('HTTP 500');
  });

  it('blocks SSRF to a private/metadata address (no fetch)', async () => {
    (lookup as jest.Mock).mockResolvedValueOnce([
      { address: '169.254.169.254', family: 4 },
    ]);
    const fetchSpy = jest.spyOn(global, 'fetch');
    const r = await h.execute({ url: 'https://metadata.evil.test' }, ctx);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/blocked/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('blocks non-http(s) schemes', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const r = await h.execute({ url: 'file:///etc/passwd' }, ctx);
    expect(r.success).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('SendMessageStepHandler', () => {
  const facade = { queueSystemMessage: jest.fn(), queueTemplateMessage: jest.fn(), assignConversationUser: jest.fn() };
  const h = new SendMessageStepHandler(facade as any);
  beforeEach(() => jest.clearAllMocks());

  it('interpolates body and queues a WHATSAPP message', async () => {
    facade.queueSystemMessage.mockResolvedValue({ conversationId: 'c1', messageId: 'm1' });
    const r = await h.execute({ channel: 'whatsapp', body: 'Olá {{name}}' }, ctx);
    expect(facade.queueSystemMessage).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', contactId: 'contact-1', channel: 'WHATSAPP', text: 'Olá João' }),
    );
    expect(r.success).toBe(true);
    expect(r.output?.messageSent).toBe(true);
  });

  it('fails for unsupported channel (web_chat)', async () => {
    const r = await h.execute({ channel: 'web_chat', body: 'x' }, ctx);
    expect(r.success).toBe(false);
    expect(facade.queueSystemMessage).not.toHaveBeenCalled();
  });

  it('fails without contactId', async () => {
    const r = await h.execute({ body: 'x' }, { ...ctx, contactId: undefined });
    expect(r.success).toBe(false);
  });
});

describe('AddTag / RemoveTag handlers', () => {
  const facade = { addTag: jest.fn(), removeTag: jest.fn() };
  beforeEach(() => jest.clearAllMocks());

  it('adds a tag via facade', async () => {
    const r = await new AddTagStepHandler(facade as any).execute({ tag: 'vip' }, ctx);
    expect(facade.addTag).toHaveBeenCalledWith('tenant-1', 'contact-1', 'vip');
    expect(r.output?.tagAdded).toBe('vip');
  });

  it('removes a tag via facade', async () => {
    const r = await new RemoveTagStepHandler(facade as any).execute({ tag: 'old' }, ctx);
    expect(facade.removeTag).toHaveBeenCalledWith('tenant-1', 'contact-1', 'old');
    expect(r.output?.tagRemoved).toBe('old');
  });

  it('fails on empty tag', async () => {
    const r = await new AddTagStepHandler(facade as any).execute({ tag: '  ' }, ctx);
    expect(r.success).toBe(false);
  });
});

describe('UpdateContactStepHandler', () => {
  const facade = { updateContactFields: jest.fn() };
  const h = new UpdateContactStepHandler(facade as any);
  beforeEach(() => jest.clearAllMocks());

  it('passes only known fields with normalized stage', async () => {
    const r = await h.execute({ fields: { stage: 'customer', notes: 'ok', unknown: 'x' } }, ctx);
    expect(facade.updateContactFields).toHaveBeenCalledWith('tenant-1', 'contact-1', { stage: 'CUSTOMER', notes: 'ok' });
    expect(r.success).toBe(true);
  });

  it('rejects invalid stage', async () => {
    const r = await h.execute({ fields: { stage: 'bogus' } }, ctx);
    expect(r.success).toBe(false);
    expect(facade.updateContactFields).not.toHaveBeenCalled();
  });

  it('fails when no known field provided', async () => {
    const r = await h.execute({ fields: { unknown: 'x' } }, ctx);
    expect(r.success).toBe(false);
  });
});

describe('AssignAgentStepHandler', () => {
  const facade = { assignConversationUser: jest.fn() };
  const h = new AssignAgentStepHandler(facade as any);
  beforeEach(() => jest.clearAllMocks());

  it('assigns the agent to the contact conversation', async () => {
    facade.assignConversationUser.mockResolvedValue({ conversationId: 'c1' });
    const r = await h.execute({ agentId: 'agent-9' }, ctx);
    expect(facade.assignConversationUser).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', contactId: 'contact-1', userId: 'agent-9' }),
    );
    expect(r.output?.assigned).toBe(true);
  });

  it('fails when no conversation exists', async () => {
    facade.assignConversationUser.mockResolvedValue(null);
    const r = await h.execute({ agentId: 'agent-9' }, ctx);
    expect(r.success).toBe(false);
  });
});

describe('AiResponseStepHandler', () => {
  const ai = { generateReply: jest.fn() };
  const messaging = { queueSystemMessage: jest.fn() };
  const h = new AiResponseStepHandler(ai as any, messaging as any);
  beforeEach(() => jest.clearAllMocks());

  it('generates a reply and sends it', async () => {
    ai.generateReply.mockResolvedValue({ text: 'Olá!' });
    messaging.queueSystemMessage.mockResolvedValue({ conversationId: 'c1', messageId: 'm1' });
    const r = await h.execute({ prompt: 'Atenda {{name}}', channel: 'whatsapp' }, ctx);
    expect(ai.generateReply).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', prompt: 'Atenda João' }),
    );
    expect(messaging.queueSystemMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Olá!', channel: 'WHATSAPP' }),
    );
    expect(r.output?.messageSent).toBe(true);
  });

  it('fails on empty AI reply', async () => {
    ai.generateReply.mockResolvedValue({ text: '' });
    const r = await h.execute({ prompt: 'x' }, ctx);
    expect(r.success).toBe(false);
  });

  it('fails (no message sent) when AI generation is denied by quota', async () => {
    ai.generateReply.mockResolvedValue({
      text: '',
      denied: true,
      reason: 'NO_SUBSCRIPTION',
    });
    const r = await h.execute({ prompt: 'x', channel: 'whatsapp' }, ctx);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/denied/i);
    expect(messaging.queueSystemMessage).not.toHaveBeenCalled();
  });
});

describe('CreateTaskStepHandler', () => {
  const facade = { createTask: jest.fn() };
  const h = new CreateTaskStepHandler(facade as any);
  beforeEach(() => jest.clearAllMocks());

  it('creates a task with interpolated title and computed dueAt', async () => {
    facade.createTask.mockResolvedValue({ taskId: 't1' });
    const before = Date.now();
    const r = await h.execute({ title: 'Ligar para {{name}}', dueInMs: 3600000 }, ctx);
    const call = facade.createTask.mock.calls[0][0];
    expect(call.title).toBe('Ligar para João');
    expect(call.dueAt.getTime()).toBeGreaterThanOrEqual(before + 3600000 - 50);
    expect(r.output?.taskId).toBe('t1');
  });

  it('fails without a title', async () => {
    const r = await h.execute({ dueInMs: 1000 }, ctx);
    expect(r.success).toBe(false);
  });
});
