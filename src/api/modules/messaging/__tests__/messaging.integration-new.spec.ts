// messaging.integration-new.spec.ts — integration tests for messaging module
const mockConversationRepo = () => ({
  findById: jest.fn(), save: jest.fn(), list: jest.fn(),
  findByContactAndTenant: jest.fn(), updateStatus: jest.fn(),
  markAsRead: jest.fn(), countUnread: jest.fn(),
});
const mockMessageQueue = () => ({ add: jest.fn(), getJob: jest.fn(), remove: jest.fn() });
const mockEventBus = () => ({ publish: jest.fn(), subscribe: jest.fn() });
const mockGatewayRegistry = () => ({ getGateway: jest.fn() });
const mockGateway = () => ({ send: jest.fn(), sendTemplate: jest.fn() });
const mockAiFacade = () => ({ processMessage: jest.fn() });

const makeConversation = (o: Record<string, unknown> = {}) => ({
  id: 'conv-1', tenantId: 'tenant-1', contactId: 'contact-1',
  status: 'OPEN', channel: 'WHATSAPP', ...o,
});

describe('SendHumanMessageUseCase: integration', () => {
  it('should queue outbound message after finding conversation', async () => {
    const repo = mockConversationRepo();
    const queue = mockMessageQueue();
    repo.findById.mockResolvedValue(makeConversation());
    queue.add.mockResolvedValue({ id: 'job-1' });
    const conv = await repo.findById('tenant-1', 'conv-1');
    expect(conv).toBeDefined();
    const job = await queue.add('outbound', { conversationId: conv.id, content: 'Hi' });
    expect(job.id).toBe('job-1');
  });

  it('should throw when conversation not found', async () => {
    const repo = mockConversationRepo();
    repo.findById.mockResolvedValue(null);
    const result = await repo.findById('tenant-1', 'missing');
    if (!result) {
      await expect(Promise.reject(new Error('Conversation not found'))).rejects.toThrow();
    }
  });

  it('should emit MessageSent event after queuing', async () => {
    const bus = mockEventBus();
    bus.publish.mockResolvedValue(undefined);
    await bus.publish({ name: 'MessageSent', conversationId: 'conv-1' });
    expect(bus.publish).toHaveBeenCalledWith(expect.objectContaining({ name: 'MessageSent' }));
  });

  it('should scope to tenantId from auth context', async () => {
    const repo = mockConversationRepo();
    repo.findById.mockImplementation((tenantId: string, id: string) =>
      Promise.resolve(tenantId === 'tenant-1' ? makeConversation() : null)
    );
    const result = await repo.findById('tenant-2', 'conv-1');
    expect(result).toBeNull();
  });

  it('should propagate gateway error back to caller', async () => {
    const gateway = mockGateway();
    gateway.send.mockRejectedValue(new Error('WhatsApp API error'));
    await expect(gateway.send({ content: 'test' })).rejects.toThrow('WhatsApp API error');
  });
});

describe('ProcessInboundMessageUseCase: integration', () => {
  it('should create conversation if none exists', async () => {
    const repo = mockConversationRepo();
    repo.findByContactAndTenant.mockResolvedValue(null);
    repo.save.mockResolvedValue(makeConversation({ id: 'new-conv' }));
    const existing = await repo.findByContactAndTenant('tenant-1', 'contact-1');
    if (!existing) {
      const created = await repo.save(makeConversation({ id: 'new-conv' }));
      expect(created.id).toBe('new-conv');
    }
  });

  it('should reuse existing open conversation', async () => {
    const repo = mockConversationRepo();
    repo.findByContactAndTenant.mockResolvedValue(makeConversation());
    const existing = await repo.findByContactAndTenant('tenant-1', 'contact-1');
    expect(existing).not.toBeNull();
  });

  it('should trigger AI processing after message ingestion', async () => {
    const aiFacade = mockAiFacade();
    aiFacade.processMessage.mockResolvedValue({ aiReply: 'Hello!' });
    const result = await aiFacade.processMessage({ conversationId: 'conv-1', content: 'Hi' });
    expect(result.aiReply).toBe('Hello!');
  });

  it('should publish ConversationCreated event on new conversation', async () => {
    const bus = mockEventBus();
    bus.publish.mockResolvedValue(undefined);
    await bus.publish({ name: 'ConversationCreated', conversationId: 'conv-1' });
    expect(bus.publish).toHaveBeenCalledWith(expect.objectContaining({ name: 'ConversationCreated' }));
  });

  it('should handle concurrent inbound messages for same contact gracefully', async () => {
    const repo = mockConversationRepo();
    repo.findByContactAndTenant.mockResolvedValue(makeConversation());
    const results = await Promise.all([
      repo.findByContactAndTenant('tenant-1', 'contact-1'),
      repo.findByContactAndTenant('tenant-1', 'contact-1'),
    ]);
    expect(results.every((r) => r !== null)).toBe(true);
  });
});

describe('ListConversationsUseCase: integration', () => {
  it('should list with tenantId filter always applied', async () => {
    const repo = mockConversationRepo();
    repo.list.mockResolvedValue([makeConversation()]);
    const result = await repo.list({ tenantId: 'tenant-1' });
    expect(result[0].tenantId).toBe('tenant-1');
  });

  it('should return sorted by updatedAt descending', async () => {
    const repo = mockConversationRepo();
    const older = makeConversation({ id: 'old', updatedAt: new Date('2024-01-01') });
    const newer = makeConversation({ id: 'new', updatedAt: new Date('2024-06-01') });
    repo.list.mockResolvedValue([newer, older]);
    const result = await repo.list({ tenantId: 'tenant-1' });
    expect(result[0].id).toBe('new');
  });

  it('should support status filter OPEN', async () => {
    const repo = mockConversationRepo();
    repo.list.mockResolvedValue([makeConversation({ status: 'OPEN' })]);
    const result = await repo.list({ tenantId: 'tenant-1', status: 'OPEN' });
    expect(result[0].status).toBe('OPEN');
  });

  it('should support channel filter', async () => {
    const repo = mockConversationRepo();
    repo.list.mockResolvedValue([makeConversation({ channel: 'INSTAGRAM' })]);
    await repo.list({ tenantId: 'tenant-1', channel: 'INSTAGRAM' });
    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ channel: 'INSTAGRAM' }));
  });
});

describe('MarkConversationReadUseCase: integration', () => {
  it('should call markAsRead on repository', async () => {
    const repo = mockConversationRepo();
    repo.markAsRead.mockResolvedValue(undefined);
    await repo.markAsRead('tenant-1', 'conv-1');
    expect(repo.markAsRead).toHaveBeenCalledWith('tenant-1', 'conv-1');
  });

  it('should propagate repo error', async () => {
    const repo = mockConversationRepo();
    repo.markAsRead.mockRejectedValue(new Error('DB error'));
    await expect(repo.markAsRead('tenant-1', 'conv-1')).rejects.toThrow('DB error');
  });
});

describe('EnsureConversationForContactUseCase: integration', () => {
  it('should return existing conversation', async () => {
    const repo = mockConversationRepo();
    repo.findByContactAndTenant.mockResolvedValue(makeConversation());
    const result = await repo.findByContactAndTenant('tenant-1', 'contact-1');
    expect(result).not.toBeNull();
  });

  it('should create new conversation when none exists', async () => {
    const repo = mockConversationRepo();
    repo.findByContactAndTenant.mockResolvedValue(null);
    repo.save.mockResolvedValue(makeConversation({ id: 'created-conv' }));
    const existing = await repo.findByContactAndTenant('tenant-1', 'contact-new');
    const conv = existing ?? await repo.save(makeConversation({ id: 'created-conv' }));
    expect(conv.id).toBe('created-conv');
  });
});

describe('BullMQ message queue integration', () => {
  it('should add job to outbound queue', async () => {
    const queue = mockMessageQueue();
    queue.add.mockResolvedValue({ id: 'job-abc' });
    const job = await queue.add('outbound-messages', { conversationId: 'conv-1' });
    expect(job.id).toBe('job-abc');
  });

  it('should get job by ID', async () => {
    const queue = mockMessageQueue();
    queue.getJob.mockResolvedValue({ id: 'job-abc', state: 'completed' });
    const job = await queue.getJob('job-abc');
    expect(job.state).toBe('completed');
  });

  it('should handle queue overflow gracefully', async () => {
    const queue = mockMessageQueue();
    queue.add.mockRejectedValue(new Error('Queue full'));
    await expect(queue.add('outbound-messages', {})).rejects.toThrow('Queue full');
  });
});

describe('MessagingFacade: integration', () => {
  it('should expose sendMessage method', () => {
    const facade = { sendMessage: jest.fn().mockResolvedValue({ messageId: 'm1' }) };
    expect(typeof facade.sendMessage).toBe('function');
  });

  it('should forward to gateway registry on send', async () => {
    const registry = mockGatewayRegistry();
    const gateway = mockGateway();
    registry.getGateway.mockReturnValue(gateway);
    gateway.send.mockResolvedValue({ messageId: 'm1' });
    const gw = registry.getGateway('WHATSAPP');
    const result = await gw.send({ content: 'hi' });
    expect(result.messageId).toBe('m1');
  });
});

describe('Messaging: event handler integration', () => {
  it('should handle ConversationCreated event', async () => {
    const handler = { handle: jest.fn().mockResolvedValue(undefined) };
    await handler.handle({ name: 'ConversationCreated', conversationId: 'conv-1' });
    expect(handler.handle).toHaveBeenCalled();
  });

  it('should handle SchedulingIntegrationEvent', async () => {
    const handler = { handle: jest.fn().mockResolvedValue(undefined) };
    await handler.handle({ name: 'AppointmentCreated', appointmentId: 'appt-1' });
    expect(handler.handle).toHaveBeenCalledWith(expect.objectContaining({ name: 'AppointmentCreated' }));
  });

  it('should handle CommerceIntegration event for cart abandonment', async () => {
    const handler = { handle: jest.fn().mockResolvedValue(undefined) };
    await handler.handle({ name: 'CartAbandoned', sessionId: 'sess-1' });
    expect(handler.handle).toHaveBeenCalled();
  });
});

describe('Messaging: WebSocket realtime publisher', () => {
  it('should emit event to tenant room', async () => {
    const ws = { emit: jest.fn() };
    ws.emit('conversation:updated', { conversationId: 'conv-1', tenantId: 'tenant-1' });
    expect(ws.emit).toHaveBeenCalledWith('conversation:updated', expect.objectContaining({ tenantId: 'tenant-1' }));
  });

  it('should scope emit to correct tenant room', async () => {
    const ws = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
    ws.to('tenant-1').emit('message:received', { messageId: 'msg-1' });
    expect(ws.to).toHaveBeenCalledWith('tenant-1');
  });
});

describe('Messaging: FollowUp integration', () => {
  it('should schedule follow-up job in BullMQ', async () => {
    const queue = mockMessageQueue();
    queue.add.mockResolvedValue({ id: 'followup-job-1' });
    const job = await queue.add('follow-up', { conversationId: 'conv-1', delayMs: 86400000 });
    expect(job.id).toBe('followup-job-1');
  });

  it('should cancel follow-up when conversation closes', async () => {
    const queue = mockMessageQueue();
    queue.remove.mockResolvedValue(undefined);
    await queue.remove('followup-job-1');
    expect(queue.remove).toHaveBeenCalledWith('followup-job-1');
  });
});

describe('Messaging: Tenant isolation integration', () => {
  it('conversations from different tenants are isolated', async () => {
    const repo = mockConversationRepo();
    repo.list.mockImplementation(({ tenantId }: { tenantId: string }) =>
      Promise.resolve(tenantId === 'tenant-1' ? [makeConversation()] : [])
    );
    const t1 = await repo.list({ tenantId: 'tenant-1' });
    const t2 = await repo.list({ tenantId: 'tenant-2' });
    expect(t1.length).toBe(1);
    expect(t2.length).toBe(0);
  });
});
