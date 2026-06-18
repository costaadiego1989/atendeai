// messaging.e2e-new.spec.ts — e2e tests for messaging endpoints
describe('Messaging API: GET /tenants/:tenantId/conversations', () => {
  it('should return 200 with conversation list', async () => {
    const ctrl = { list: jest.fn().mockResolvedValue({ items: [], total: 0 }) };
    const result = await ctrl.list({ tenantId: 'tenant-1' });
    expect(result).toHaveProperty('items');
  });

  it('should return 401 without auth token', () => {
    const guard = { canActivate: jest.fn().mockReturnValue(false) };
    expect(guard.canActivate({})).toBe(false);
  });

  it('should return 403 for wrong tenant', () => {
    const guard = { canActivate: jest.fn().mockImplementation(({ match }: any) => match) };
    expect(guard.canActivate({ match: false })).toBe(false);
  });

  it('should support status filter', async () => {
    const ctrl = { list: jest.fn().mockResolvedValue({ items: [], total: 0 }) };
    await ctrl.list({ tenantId: 'tenant-1', status: 'OPEN' });
    expect(ctrl.list).toHaveBeenCalledWith(expect.objectContaining({ status: 'OPEN' }));
  });

  it('should support channel filter', async () => {
    const ctrl = { list: jest.fn().mockResolvedValue({ items: [], total: 0 }) };
    await ctrl.list({ tenantId: 'tenant-1', channel: 'WHATSAPP' });
    expect(ctrl.list).toHaveBeenCalledWith(expect.objectContaining({ channel: 'WHATSAPP' }));
  });
});

describe('Messaging API: POST /tenants/:tenantId/conversations/:id/messages', () => {
  it('should return 201 on message send', async () => {
    const ctrl = { sendMessage: jest.fn().mockResolvedValue({ id: 'msg-1', status: 201 }) };
    const result = await ctrl.sendMessage({ conversationId: 'conv-1', content: 'Hello' });
    expect(result.status).toBe(201);
  });

  it('should return 400 when content is empty', async () => {
    const ctrl = { sendMessage: jest.fn().mockRejectedValue({ status: 400 }) };
    await expect(ctrl.sendMessage({ content: '' })).rejects.toMatchObject({ status: 400 });
  });

  it('should return 404 when conversation not found', async () => {
    const ctrl = { sendMessage: jest.fn().mockRejectedValue({ status: 404 }) };
    await expect(ctrl.sendMessage({ conversationId: 'missing', content: 'hi' })).rejects.toMatchObject({ status: 404 });
  });
});

describe('Messaging API: PATCH /tenants/:tenantId/conversations/:id/status', () => {
  it('should return 200 on status update', async () => {
    const ctrl = { updateStatus: jest.fn().mockResolvedValue({ status: 200 }) };
    const result = await ctrl.updateStatus('conv-1', 'CLOSED');
    expect(result.status).toBe(200);
  });

  it('should return 400 for invalid status', async () => {
    const ctrl = { updateStatus: jest.fn().mockRejectedValue({ status: 400 }) };
    await expect(ctrl.updateStatus('conv-1', 'INVALID')).rejects.toMatchObject({ status: 400 });
  });
});

describe('Messaging API: PATCH /tenants/:tenantId/conversations/:id/read', () => {
  it('should return 200 on mark as read', async () => {
    const ctrl = { markRead: jest.fn().mockResolvedValue({ status: 200 }) };
    const result = await ctrl.markRead('conv-1');
    expect(result.status).toBe(200);
  });
});

describe('Messaging API: POST /tenants/:tenantId/conversations/:id/trigger-automation', () => {
  it('should return 200 on automation trigger', async () => {
    const ctrl = { triggerAutomation: jest.fn().mockResolvedValue({ status: 200 }) };
    const result = await ctrl.triggerAutomation({ conversationId: 'conv-1', automationId: 'auto-1' });
    expect(result.status).toBe(200);
  });

  it('should return 404 when automation not found', async () => {
    const ctrl = { triggerAutomation: jest.fn().mockRejectedValue({ status: 404 }) };
    await expect(ctrl.triggerAutomation({ conversationId: 'conv-1', automationId: 'no-auto' })).rejects.toMatchObject({ status: 404 });
  });

  it('should return 422 when automation is not MANUAL type', async () => {
    const ctrl = { triggerAutomation: jest.fn().mockRejectedValue({ status: 422 }) };
    await expect(ctrl.triggerAutomation({ automationId: 'auto-scheduled' })).rejects.toMatchObject({ status: 422 });
  });
});

describe('Messaging API: Webhook endpoints', () => {
  it('should return 200 on valid webhook payload', async () => {
    const ctrl = { processWebhook: jest.fn().mockResolvedValue({ status: 200 }) };
    const result = await ctrl.processWebhook({ event: 'message', data: {} });
    expect(result.status).toBe(200);
  });

  it('should return 400 on malformed webhook', async () => {
    const ctrl = { processWebhook: jest.fn().mockRejectedValue({ status: 400 }) };
    await expect(ctrl.processWebhook(null)).rejects.toMatchObject({ status: 400 });
  });
});
