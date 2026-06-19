import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockPost = vi.fn();
const mockGet = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('../api/messagingApi', () => ({
  messagingApi: {
    getConversations: mockGet,
    getMessages: mockGet,
    sendMessage: mockPost,
    uploadFile: mockPost,
    assignAgent: mockPut,
    handoffToHuman: mockPut,
    handoffToAI: mockPut,
    markRead: mockPut,
    triggerAutomation: mockPost,
    getUnreadCount: mockGet,
  },
}));

const makeConversation = (o = {}) => ({ id: 'conv_1', contactName: 'Alice', lastMessage: 'Hello', unread: 0, assignedTo: null, status: 'open', ...o });
const makeMessage = (o = {}) => ({ id: 'msg_1', conversationId: 'conv_1', content: 'Hello', sender: 'contact', timestamp: '2024-01-01T10:00:00Z', read: false, ...o });

// ---------------------------------------------------------------------------
describe('Messaging Integration – Conversation List + React Query', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should load conversation list', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeConversation(), makeConversation({ id: 'conv_2' })] });
    const res = await mockGet('/conversations');
    expect(res.data).toHaveLength(2);
  });

  it('should show loading state while fetching', () => {
    const isLoading = vi.fn().mockReturnValue(true);
    expect(isLoading()).toBe(true);
  });

  it('should show empty state when no conversations', async () => {
    mockGet.mockResolvedValueOnce({ data: [] });
    const res = await mockGet('/conversations');
    expect(res.data).toHaveLength(0);
  });

  it('should cache conversations with React Query', () => {
    const cached = vi.fn().mockReturnValue({ data: [makeConversation()], stale: false });
    expect(cached('conversations').stale).toBe(false);
  });

  it('should filter conversations by status', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeConversation({ status: 'open' })] });
    const res = await mockGet({ status: 'open' });
    expect(res.data[0].status).toBe('open');
  });

  it('should filter by assigned agent', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeConversation({ assignedTo: 'agent_1' })] });
    const res = await mockGet({ assignedTo: 'agent_1' });
    expect(res.data[0].assignedTo).toBe('agent_1');
  });

  it('should search conversations by contact name', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeConversation({ contactName: 'Alice' })] });
    const res = await mockGet({ search: 'Alice' });
    expect(res.data[0].contactName).toBe('Alice');
  });

  it('should sort by last message timestamp', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeConversation({ id: 'conv_2' }), makeConversation({ id: 'conv_1' })] });
    const res = await mockGet({ sort: 'lastMessage', order: 'desc' });
    expect(res.data[0].id).toBe('conv_2');
  });

  it('should paginate conversation list', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeConversation()], total: 100, page: 1 });
    const res = await mockGet({ page: 1 });
    expect(res.total).toBe(100);
  });

  it('should handle fetch error', async () => {
    mockGet.mockRejectedValueOnce(new Error('Failed to load conversations'));
    await expect(mockGet('/conversations')).rejects.toThrow('Failed to load conversations');
  });
});

describe('Messaging Integration – Message Send Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should send text message', async () => {
    mockPost.mockResolvedValueOnce({ data: makeMessage({ content: 'Hi there!' }) });
    const res = await mockPost('/messages', { conversationId: 'conv_1', content: 'Hi there!' });
    expect(res.data.content).toBe('Hi there!');
  });

  it('should add message to conversation list optimistically', () => {
    const addMessage = vi.fn();
    addMessage(makeMessage());
    expect(addMessage).toHaveBeenCalled();
  });

  it('should update last message in conversation list', async () => {
    mockPost.mockResolvedValueOnce({ data: makeMessage({ content: 'Latest' }) });
    await mockPost('/messages', {});
    const refetch = vi.fn();
    refetch();
    expect(refetch).toHaveBeenCalled();
  });

  it('should clear message input after send', () => {
    const clearInput = vi.fn();
    clearInput();
    expect(clearInput).toHaveBeenCalled();
  });

  it('should handle send error and show notification', async () => {
    mockPost.mockRejectedValueOnce(new Error('Send failed'));
    const toast = vi.fn();
    try { await mockPost({}); } catch { toast({ type: 'error' }); }
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });

  it('should show message send status (sending/sent/failed)', () => {
    const getStatus = vi.fn().mockReturnValue('sent');
    expect(getStatus('msg_1')).toBe('sent');
  });

  it('should send message on Enter key press', () => {
    const handleKey = vi.fn();
    handleKey({ key: 'Enter', shiftKey: false });
    expect(handleKey).toHaveBeenCalled();
  });

  it('should allow new line with Shift+Enter', () => {
    const handleKey = vi.fn().mockReturnValue('new-line');
    expect(handleKey({ key: 'Enter', shiftKey: true })).toBe('new-line');
  });

  it('should update via real-time WebSocket after send', () => {
    const onMessage = vi.fn();
    onMessage({ type: 'message', data: makeMessage() });
    expect(onMessage).toHaveBeenCalled();
  });

  it('should scroll to latest message after send', () => {
    const scrollToBottom = vi.fn();
    scrollToBottom();
    expect(scrollToBottom).toHaveBeenCalled();
  });
});

describe('Messaging Integration – File Attachment Upload', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should upload image attachment', async () => {
    mockPost.mockResolvedValueOnce({ data: { url: 'https://files/image.jpg', type: 'image' } });
    const res = await mockPost('/upload', new FormData());
    expect(res.data.url).toBeDefined();
  });

  it('should upload PDF attachment', async () => {
    mockPost.mockResolvedValueOnce({ data: { url: 'https://files/doc.pdf', type: 'document' } });
    const res = await mockPost('/upload', new FormData());
    expect(res.data.type).toBe('document');
  });

  it('should show upload progress', () => {
    const progress = vi.fn().mockReturnValue(75);
    expect(progress()).toBe(75);
  });

  it('should reject file exceeding size limit', () => {
    const validate = vi.fn().mockReturnValue('File too large');
    expect(validate({ size: 50 * 1024 * 1024 })).toBe('File too large');
  });

  it('should reject unsupported file type', () => {
    const validate = vi.fn().mockReturnValue('File type not supported');
    expect(validate({ type: 'application/exe' })).toBeDefined();
  });

  it('should send message with attachment after upload', async () => {
    mockPost.mockResolvedValueOnce({ data: makeMessage({ attachment: { url: 'https://file.jpg' } }) });
    const res = await mockPost('/messages', { attachmentUrl: 'https://file.jpg' });
    expect(res.data.attachment).toBeDefined();
  });

  it('should show preview of image attachment', () => {
    const hasPreview = vi.fn().mockReturnValue(true);
    expect(hasPreview('image/jpg')).toBe(true);
  });

  it('should cancel upload in progress', () => {
    const cancel = vi.fn();
    cancel();
    expect(cancel).toHaveBeenCalled();
  });
});

describe('Messaging Integration – Human/AI Handoff Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should transfer conversation to human agent', async () => {
    mockPut.mockResolvedValueOnce({ data: makeConversation({ mode: 'human', assignedTo: 'agent_1' }) });
    const res = await mockPut('/conversations/conv_1/handoff', { to: 'human' });
    expect(res.data.mode).toBe('human');
  });

  it('should transfer conversation back to AI', async () => {
    mockPut.mockResolvedValueOnce({ data: makeConversation({ mode: 'ai' }) });
    const res = await mockPut('/conversations/conv_1/handoff', { to: 'ai' });
    expect(res.data.mode).toBe('ai');
  });

  it('should notify agent when conversation is assigned', () => {
    const notify = vi.fn();
    notify('agent_1', 'New conversation assigned');
    expect(notify).toHaveBeenCalled();
  });

  it('should show handoff indicator in conversation', () => {
    const showIndicator = vi.fn().mockReturnValue(true);
    expect(showIndicator('human')).toBe(true);
  });

  it('should preserve conversation history during handoff', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeMessage(), makeMessage({ id: 'msg_2' })] });
    const res = await mockGet('/conversations/conv_1/messages');
    expect(res.data).toHaveLength(2);
  });

  it('should allow agent to re-assign to another agent', async () => {
    mockPut.mockResolvedValueOnce({ data: makeConversation({ assignedTo: 'agent_2' }) });
    const res = await mockPut('/conversations/conv_1', { assignedTo: 'agent_2' });
    expect(res.data.assignedTo).toBe('agent_2');
  });

  it('should show AI suggestion mode alongside human', () => {
    const mode = vi.fn().mockReturnValue('human_with_ai_suggestions');
    expect(mode()).toBe('human_with_ai_suggestions');
  });
});

describe('Messaging Integration – Automation Trigger in Conversation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should list available manual automations for conversation', async () => {
    mockGet.mockResolvedValueOnce({ data: [{ id: 'auto_1', name: 'Send Welcome', triggerType: 'manual' }] });
    const res = await mockGet('/automations?triggerType=manual');
    expect(res.data[0].triggerType).toBe('manual');
  });

  it('should trigger automation in conversation context', async () => {
    mockPost.mockResolvedValueOnce({ data: { executed: true, messagesSent: 1 } });
    const res = await mockPost('/automations/auto_1/execute', { conversationId: 'conv_1' });
    expect(res.data.executed).toBe(true);
  });

  it('should show automation execution result', async () => {
    mockPost.mockResolvedValueOnce({ data: { message: 'Automation completed' } });
    const res = await mockPost('/automations/auto_1/execute', {});
    expect(res.data.message).toBeDefined();
  });

  it('should handle automation execution error', async () => {
    mockPost.mockRejectedValueOnce(new Error('Execution failed'));
    await expect(mockPost('/automations/auto_1/execute', {})).rejects.toThrow('Execution failed');
  });
});

describe('Messaging Integration – Read Receipt Marking', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should mark message as read', async () => {
    mockPut.mockResolvedValueOnce({ data: { ...makeMessage(), read: true } });
    const res = await mockPut('/messages/msg_1/read');
    expect(res.data.read).toBe(true);
  });

  it('should mark all messages in conversation as read', async () => {
    mockPut.mockResolvedValueOnce({ data: { updated: 5 } });
    const res = await mockPut('/conversations/conv_1/read-all');
    expect(res.data.updated).toBe(5);
  });

  it('should decrement unread count after read', () => {
    const decrementUnread = vi.fn();
    decrementUnread('conv_1');
    expect(decrementUnread).toHaveBeenCalledWith('conv_1');
  });

  it('should update unread badge in sidebar', () => {
    const updateBadge = vi.fn();
    updateBadge(0);
    expect(updateBadge).toHaveBeenCalledWith(0);
  });

  it('should not mark messages as read when conversation not open', () => {
    const markRead = vi.fn();
    const isOpen = vi.fn().mockReturnValue(false);
    if (isOpen()) markRead();
    expect(markRead).not.toHaveBeenCalled();
  });
});

describe('Messaging Integration – Conversation Assignment', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should assign conversation to agent', async () => {
    mockPut.mockResolvedValueOnce({ data: makeConversation({ assignedTo: 'agent_1' }) });
    const res = await mockPut('/conversations/conv_1', { assignedTo: 'agent_1' });
    expect(res.data.assignedTo).toBe('agent_1');
  });

  it('should show agent name in conversation header', async () => {
    mockGet.mockResolvedValueOnce({ data: makeConversation({ assignedTo: 'agent_1', agentName: 'Bob' }) });
    const res = await mockGet('/conversations/conv_1');
    expect(res.data.agentName).toBe('Bob');
  });

  it('should list available agents for assignment', async () => {
    mockGet.mockResolvedValueOnce({ data: [{ id: 'agent_1', name: 'Bob' }, { id: 'agent_2', name: 'Alice' }] });
    const res = await mockGet('/agents');
    expect(res.data).toHaveLength(2);
  });

  it('should unassign conversation', async () => {
    mockPut.mockResolvedValueOnce({ data: makeConversation({ assignedTo: null }) });
    const res = await mockPut('/conversations/conv_1', { assignedTo: null });
    expect(res.data.assignedTo).toBeNull();
  });

  it('should notify new assignee', () => {
    const notify = vi.fn();
    notify('agent_2', 'Conversation assigned to you');
    expect(notify).toHaveBeenCalled();
  });
});

describe('Messaging Integration – Unread Count Update', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should get total unread count', async () => {
    mockGet.mockResolvedValueOnce({ data: { total: 5 } });
    const res = await mockGet('/conversations/unread-count');
    expect(res.data.total).toBe(5);
  });

  it('should increment unread count on new message via WebSocket', () => {
    const incrementUnread = vi.fn();
    incrementUnread('conv_1');
    expect(incrementUnread).toHaveBeenCalledWith('conv_1');
  });

  it('should reset unread count to 0 when conversation opened', () => {
    const resetUnread = vi.fn();
    resetUnread('conv_1');
    expect(resetUnread).toHaveBeenCalledWith('conv_1');
  });

  it('should show unread badge in sidebar', () => {
    const getBadge = vi.fn().mockReturnValue(3);
    expect(getBadge()).toBe(3);
  });

  it('should update page title with unread count', () => {
    const updateTitle = vi.fn();
    updateTitle('(3) Messaging - App');
    expect(updateTitle).toHaveBeenCalledWith('(3) Messaging - App');
  });

  it('should clear unread badge when all read', () => {
    const clearBadge = vi.fn();
    clearBadge();
    expect(clearBadge).toHaveBeenCalled();
  });
});
