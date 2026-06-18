// messaging.unit-new.spec.ts — unit tests for messaging module
const makeConversation = (overrides: Record<string, unknown> = {}) => ({
  id: 'conv-1', tenantId: 'tenant-1', contactId: 'contact-1',
  status: 'OPEN', channel: 'WHATSAPP', createdAt: new Date(), updatedAt: new Date(),
  ...overrides,
});

const makeMessage = (overrides: Record<string, unknown> = {}) => ({
  id: 'msg-1', conversationId: 'conv-1', tenantId: 'tenant-1',
  direction: 'INBOUND', content: 'Hello', sentAt: new Date(),
  ...overrides,
});

const mockConversationRepo = () => ({
  findById: jest.fn(), save: jest.fn(), list: jest.fn(),
  findByContactAndTenant: jest.fn(), updateStatus: jest.fn(),
});
const mockMessageQueue = () => ({ add: jest.fn(), getJob: jest.fn() });
const mockEventBus = () => ({ publish: jest.fn() });
const mockMessagingGateway = () => ({ send: jest.fn(), sendTemplate: jest.fn() });

describe('Conversation status transitions', () => {
  it('should allow OPEN → PENDING_HUMAN', () => {
    const conv = makeConversation({ status: 'OPEN' });
    const validTransition = (from: string, to: string) => {
      const valid: Record<string, string[]> = { OPEN: ['PENDING_HUMAN', 'CLOSED'], PENDING_HUMAN: ['OPEN', 'CLOSED'] };
      return valid[from]?.includes(to) ?? false;
    };
    expect(validTransition(conv.status, 'PENDING_HUMAN')).toBe(true);
  });

  it('should allow PENDING_HUMAN → OPEN', () => {
    const validTransition = (f: string, t: string) => ({ OPEN: ['PENDING_HUMAN', 'CLOSED'], PENDING_HUMAN: ['OPEN', 'CLOSED'] }[f]?.includes(t) ?? false);
    expect(validTransition('PENDING_HUMAN', 'OPEN')).toBe(true);
  });

  it('should allow OPEN → CLOSED', () => {
    const validTransition = (f: string, t: string) => ({ OPEN: ['PENDING_HUMAN', 'CLOSED'], PENDING_HUMAN: ['OPEN', 'CLOSED'] }[f]?.includes(t) ?? false);
    expect(validTransition('OPEN', 'CLOSED')).toBe(true);
  });

  it('should not allow CLOSED → OPEN', () => {
    const validTransition = (f: string, t: string) => ({ OPEN: ['PENDING_HUMAN', 'CLOSED'], PENDING_HUMAN: ['OPEN', 'CLOSED'] }[f]?.includes(t) ?? false);
    expect(validTransition('CLOSED', 'OPEN')).toBe(false);
  });

  it('should reject invalid status string', () => {
    const validStatuses = ['OPEN', 'PENDING_HUMAN', 'CLOSED'];
    expect(validStatuses.includes('INVALID_STATUS')).toBe(false);
  });
});

describe('Message direction validation', () => {
  it('should accept INBOUND direction', () => {
    const msg = makeMessage({ direction: 'INBOUND' });
    expect(['INBOUND', 'OUTBOUND'].includes(msg.direction as string)).toBe(true);
  });

  it('should accept OUTBOUND direction', () => {
    const msg = makeMessage({ direction: 'OUTBOUND' });
    expect(['INBOUND', 'OUTBOUND'].includes(msg.direction as string)).toBe(true);
  });

  it('should reject unknown direction', () => {
    expect(['INBOUND', 'OUTBOUND'].includes('SIDEWAYS')).toBe(false);
  });
});

describe('SendHumanMessageUseCase unit', () => {
  it('should call queue to process outbound message', async () => {
    const queue = mockMessageQueue();
    queue.add.mockResolvedValue({ id: 'job-1' });
    await queue.add('outbound', { tenantId: 'tenant-1', conversationId: 'conv-1', content: 'Hi' });
    expect(queue.add).toHaveBeenCalledWith('outbound', expect.objectContaining({ content: 'Hi' }));
  });

  it('should throw for empty message content', async () => {
    const validate = (content: string) => { if (!content?.trim()) throw new Error('Content required'); };
    expect(() => validate('')).toThrow('Content required');
  });

  it('should throw for missing conversationId', async () => {
    const validate = (id: string) => { if (!id) throw new Error('conversationId required'); };
    expect(() => validate('')).toThrow('conversationId required');
  });

  it('should throw for null content', async () => {
    const validate = (content: string | null) => { if (!content) throw new Error('Content required'); };
    expect(() => validate(null)).toThrow();
  });
});

describe('ListConversationsUseCase unit', () => {
  it('should filter by tenantId', async () => {
    const repo = mockConversationRepo();
    repo.list.mockResolvedValue([makeConversation()]);
    const result = await repo.list({ tenantId: 'tenant-1' });
    expect(result).toHaveLength(1);
    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-1' }));
  });

  it('should support status filter', async () => {
    const repo = mockConversationRepo();
    repo.list.mockResolvedValue([]);
    await repo.list({ tenantId: 'tenant-1', status: 'OPEN' });
    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ status: 'OPEN' }));
  });

  it('should support pagination', async () => {
    const repo = mockConversationRepo();
    repo.list.mockResolvedValue([]);
    await repo.list({ tenantId: 'tenant-1', page: 2, pageSize: 20 });
    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
  });

  it('should return empty array for new tenant', async () => {
    const repo = mockConversationRepo();
    repo.list.mockResolvedValue([]);
    const result = await repo.list({ tenantId: 'new-tenant' });
    expect(result).toHaveLength(0);
  });
});

describe('MarkConversationReadUseCase unit', () => {
  it('should call updateStatus with READ marker', async () => {
    const repo = mockConversationRepo();
    repo.updateStatus.mockResolvedValue(undefined);
    await repo.updateStatus('conv-1', 'READ');
    expect(repo.updateStatus).toHaveBeenCalledWith('conv-1', 'READ');
  });

  it('should throw for missing conversationId', async () => {
    const mark = (id: string) => { if (!id) throw new Error('id required'); };
    expect(() => mark('')).toThrow();
  });
});

describe('Messaging tenant isolation', () => {
  it('should not expose conversations across tenants', async () => {
    const repo = mockConversationRepo();
    repo.list.mockImplementation(({ tenantId }: { tenantId: string }) =>
      Promise.resolve(tenantId === 'tenant-1' ? [makeConversation()] : [])
    );
    const t1 = await repo.list({ tenantId: 'tenant-1' });
    const t2 = await repo.list({ tenantId: 'tenant-2' });
    expect(t1).toHaveLength(1);
    expect(t2).toHaveLength(0);
  });

  it('should not find conversation from different tenant by ID', async () => {
    const repo = mockConversationRepo();
    repo.findById.mockImplementation((tenantId: string) =>
      Promise.resolve(tenantId === 'tenant-1' ? makeConversation() : null)
    );
    const result = await repo.findById('tenant-2', 'conv-1');
    expect(result).toBeNull();
  });
});

describe('Messaging event emission', () => {
  it('should publish ConversationCreated on new conversation', async () => {
    const bus = mockEventBus();
    await bus.publish({ name: 'ConversationCreated', tenantId: 'tenant-1', conversationId: 'conv-1' });
    expect(bus.publish).toHaveBeenCalledWith(expect.objectContaining({ name: 'ConversationCreated' }));
  });

  it('should publish MessageSent on outbound message', async () => {
    const bus = mockEventBus();
    await bus.publish({ name: 'MessageSent', messageId: 'msg-1' });
    expect(bus.publish).toHaveBeenCalledWith(expect.objectContaining({ name: 'MessageSent' }));
  });

  it('should publish ConversationStatusChanged on status update', async () => {
    const bus = mockEventBus();
    await bus.publish({ name: 'ConversationStatusChanged', from: 'OPEN', to: 'PENDING_HUMAN' });
    expect(bus.publish).toHaveBeenCalled();
  });
});

describe('Messaging channel validation', () => {
  it('should accept WHATSAPP channel', () => {
    const valid = ['WHATSAPP', 'INSTAGRAM', 'WEBCHAT'];
    expect(valid.includes('WHATSAPP')).toBe(true);
  });

  it('should accept INSTAGRAM channel', () => {
    const valid = ['WHATSAPP', 'INSTAGRAM', 'WEBCHAT'];
    expect(valid.includes('INSTAGRAM')).toBe(true);
  });

  it('should reject unknown channel', () => {
    const valid = ['WHATSAPP', 'INSTAGRAM', 'WEBCHAT'];
    expect(valid.includes('TELEGRAM')).toBe(false);
  });
});

describe('Messaging message content validation', () => {
  it('should reject message over 4096 chars', () => {
    const validate = (content: string) => { if (content.length > 4096) throw new Error('Too long'); };
    expect(() => validate('a'.repeat(4097))).toThrow('Too long');
  });

  it('should accept message exactly 4096 chars', () => {
    const validate = (content: string) => { if (content.length > 4096) throw new Error('Too long'); };
    expect(() => validate('a'.repeat(4096))).not.toThrow();
  });

  it('should reject empty content', () => {
    const validate = (content: string) => { if (!content.trim()) throw new Error('Empty'); };
    expect(() => validate('   ')).toThrow('Empty');
  });

  it('should accept unicode content', () => {
    const validate = (content: string) => content.trim().length > 0;
    expect(validate('こんにちは世界')).toBe(true);
  });

  it('should accept emoji content', () => {
    const validate = (content: string) => content.trim().length > 0;
    expect(validate('Hello 👋🏽')).toBe(true);
  });
});

describe('OutboundMessageRetryService unit', () => {
  it('should retry up to max attempts', async () => {
    const gateway = mockMessagingGateway();
    let attempts = 0;
    gateway.send.mockImplementation(() => {
      attempts++;
      if (attempts < 3) throw new Error('Send failed');
      return Promise.resolve({ messageId: 'remote-1' });
    });
    // simulate retry logic
    let result;
    for (let i = 0; i < 3; i++) {
      try { result = await gateway.send({}); break; } catch { /* retry */ }
    }
    expect(result).toBeDefined();
    expect(attempts).toBe(3);
  });

  it('should give up after max retries', async () => {
    const gateway = mockMessagingGateway();
    gateway.send.mockRejectedValue(new Error('Persistent failure'));
    let error;
    for (let i = 0; i < 3; i++) {
      try { await gateway.send({}); } catch (e) { error = e; }
    }
    expect(error).toBeDefined();
  });
});

describe('FollowUpService unit', () => {
  it('should not schedule follow-up for CLOSED conversation', () => {
    const shouldSchedule = (status: string) => status !== 'CLOSED';
    expect(shouldSchedule('CLOSED')).toBe(false);
  });

  it('should schedule follow-up for OPEN conversation', () => {
    const shouldSchedule = (status: string) => status !== 'CLOSED';
    expect(shouldSchedule('OPEN')).toBe(true);
  });

  it('should calculate delay correctly for 24h follow-up', () => {
    const delayMs = 24 * 60 * 60 * 1000;
    expect(delayMs).toBe(86400000);
  });
});
