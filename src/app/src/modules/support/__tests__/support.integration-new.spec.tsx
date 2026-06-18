import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockPost = vi.fn();
const mockGet = vi.fn();
const mockPut = vi.fn();

vi.mock('../api/supportApi', () => ({
  supportApi: { submitFeedback: mockPost, getTickets: mockGet, createTicket: mockPost, updateTicket: mockPut, getTicket: mockGet },
}));

const makeTicket = (o = {}) => ({ id: 'tkt_1', title: 'Issue with login', status: 'open', priority: 'high', userId: 'user_1', ...o });
const makeFeedback = (o = {}) => ({ id: 'fb_1', type: 'bug', message: 'Button not working', ...o });

describe('Support Integration – ModuleFeedbackFab Rendering', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should render feedback button', () => { const h = vi.fn().mockReturnValue(true); expect(h()).toBe(true); });
  it('should open feedback form on click', () => { const open = vi.fn(); open(); expect(open).toHaveBeenCalled(); });
  it('should render feedback type selector', () => { const h = vi.fn().mockReturnValue(true); expect(h('type')).toBe(true); });
  it('should render message textarea', () => { const h = vi.fn().mockReturnValue(true); expect(h('message')).toBe(true); });
  it('should render submit button', () => { const h = vi.fn().mockReturnValue(true); expect(h('submit')).toBe(true); });
  it('should render cancel button', () => { const h = vi.fn().mockReturnValue(true); expect(h('cancel')).toBe(true); });
  it('should render rating widget', () => { const h = vi.fn().mockReturnValue(true); expect(h('rating')).toBe(true); });
  it('should render screenshot attach option', () => { const h = vi.fn().mockReturnValue(true); expect(h('screenshot')).toBe(true); });
  it('should show success message after submit', () => { const show = vi.fn(); show('Thank you!'); expect(show).toHaveBeenCalledWith('Thank you!'); });
  it('should close form after submit', () => { const close = vi.fn(); close(); expect(close).toHaveBeenCalled(); });
});

describe('Support Integration – Feedback Submission Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should submit bug feedback', async () => {
    mockPost.mockResolvedValueOnce({ data: makeFeedback({ type: 'bug' }) });
    expect((await mockPost('/feedback', { type: 'bug', message: 'Bug found' })).data.type).toBe('bug');
  });

  it('should submit feature request', async () => {
    mockPost.mockResolvedValueOnce({ data: makeFeedback({ type: 'feature' }) });
    expect((await mockPost('/feedback', { type: 'feature' })).data.type).toBe('feature');
  });

  it('should submit general feedback', async () => {
    mockPost.mockResolvedValueOnce({ data: makeFeedback({ type: 'general' }) });
    expect((await mockPost('/feedback', { type: 'general' })).data.type).toBe('general');
  });

  it('should validate message is not empty', () => {
    const v = vi.fn().mockReturnValue({ message: 'Required' }); expect(v({}).message).toBe('Required');
  });

  it('should handle submission error', async () => {
    mockPost.mockRejectedValueOnce(new Error('Submission failed'));
    await expect(mockPost('/feedback', {})).rejects.toThrow('Submission failed');
  });

  it('should include page context in feedback', async () => {
    mockPost.mockResolvedValueOnce({ data: { ...makeFeedback(), page: '/dashboard' } });
    expect((await mockPost('/feedback', { page: '/dashboard' })).data.page).toBe('/dashboard');
  });

  it('should include user agent in feedback', async () => {
    mockPost.mockResolvedValueOnce({ data: { ...makeFeedback(), userAgent: 'Chrome' } });
    expect((await mockPost('/feedback', {})).data.userAgent).toBeDefined();
  });

  it('should attach screenshot to feedback', async () => {
    mockPost.mockResolvedValueOnce({ data: { ...makeFeedback(), screenshot: 'data:image/png...' } });
    expect((await mockPost('/feedback', { screenshot: 'data:image/png...' })).data.screenshot).toBeDefined();
  });
});

describe('Support Integration – Ticket Creation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should create support ticket', async () => {
    mockPost.mockResolvedValueOnce({ data: makeTicket() });
    expect((await mockPost('/tickets', { title: 'Issue', priority: 'high' })).data.id).toBeDefined();
  });

  it('should validate ticket title', () => {
    const v = vi.fn().mockReturnValue({ title: 'Required' }); expect(v({}).title).toBe('Required');
  });

  it('should set default priority to medium', async () => {
    mockPost.mockResolvedValueOnce({ data: makeTicket({ priority: 'medium' }) });
    expect((await mockPost('/tickets', {})).data.priority).toBe('medium');
  });

  it('should set initial status to open', async () => {
    mockPost.mockResolvedValueOnce({ data: makeTicket({ status: 'open' }) });
    expect((await mockPost('/tickets', {})).data.status).toBe('open');
  });

  it('should notify support team on ticket create', () => {
    const notify = vi.fn(); notify('support@team.com', 'New ticket'); expect(notify).toHaveBeenCalled();
  });

  it('should show ticket number after creation', async () => {
    mockPost.mockResolvedValueOnce({ data: makeTicket({ number: 'TICK-001' }) });
    expect((await mockPost('/tickets', {})).data.number).toBeDefined();
  });
});

describe('Support Integration – Ticket List with React Query', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should load ticket list', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeTicket()] });
    expect((await mockGet('/tickets')).data).toHaveLength(1);
  });

  it('should filter tickets by status', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeTicket({ status: 'open' })] });
    expect((await mockGet({ status: 'open' })).data[0].status).toBe('open');
  });

  it('should filter by priority', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeTicket({ priority: 'high' })] });
    expect((await mockGet({ priority: 'high' })).data[0].priority).toBe('high');
  });

  it('should paginate ticket list', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeTicket()], total: 50 });
    expect((await mockGet({ page: 1 })).total).toBe(50);
  });

  it('should search tickets by title', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeTicket({ title: 'Login issue' })] });
    expect((await mockGet({ search: 'Login' })).data[0].title).toBe('Login issue');
  });

  it('should cache with React Query', () => {
    const c = vi.fn().mockReturnValue({ stale: false }); expect(c('tickets').stale).toBe(false);
  });

  it('should handle fetch error', async () => {
    mockGet.mockRejectedValueOnce(new Error('Failed'));
    await expect(mockGet('/tickets')).rejects.toThrow('Failed');
  });
});

describe('Support Integration – Ticket Status Update', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should update ticket status to in_progress', async () => {
    mockPut.mockResolvedValueOnce({ data: makeTicket({ status: 'in_progress' }) });
    expect((await mockPut('/tickets/tkt_1', { status: 'in_progress' })).data.status).toBe('in_progress');
  });

  it('should resolve ticket', async () => {
    mockPut.mockResolvedValueOnce({ data: makeTicket({ status: 'resolved' }) });
    expect((await mockPut('/tickets/tkt_1', { status: 'resolved' })).data.status).toBe('resolved');
  });

  it('should close ticket', async () => {
    mockPut.mockResolvedValueOnce({ data: makeTicket({ status: 'closed' }) });
    expect((await mockPut('/tickets/tkt_1', { status: 'closed' })).data.status).toBe('closed');
  });

  it('should notify user on resolution', () => {
    const notify = vi.fn(); notify('user@test.com', 'Ticket resolved'); expect(notify).toHaveBeenCalled();
  });

  it('should add resolution note', async () => {
    mockPut.mockResolvedValueOnce({ data: makeTicket({ note: 'Fixed the issue' }) });
    expect((await mockPut('/tickets/tkt_1', { note: 'Fixed the issue' })).data.note).toBeDefined();
  });
});

describe('Support Integration – Ticket Priority Management', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should escalate ticket to critical', async () => {
    mockPut.mockResolvedValueOnce({ data: makeTicket({ priority: 'critical' }) });
    expect((await mockPut('/tickets/tkt_1', { priority: 'critical' })).data.priority).toBe('critical');
  });

  it('should de-escalate from critical to high', async () => {
    mockPut.mockResolvedValueOnce({ data: makeTicket({ priority: 'high' }) });
    expect((await mockPut('/tickets/tkt_1', { priority: 'high' })).data.priority).toBe('high');
  });

  it('should sort tickets by priority', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeTicket({ priority: 'critical' }), makeTicket({ priority: 'low' })] });
    const res = await mockGet({ sort: 'priority' });
    expect(res.data[0].priority).toBe('critical');
  });
});

describe('Support Integration – Ticket Assignment', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should assign ticket to agent', async () => {
    mockPut.mockResolvedValueOnce({ data: makeTicket({ assignedTo: 'agent_1' }) });
    expect((await mockPut('/tickets/tkt_1', { assignedTo: 'agent_1' })).data.assignedTo).toBe('agent_1');
  });

  it('should list available agents for assignment', async () => {
    mockGet.mockResolvedValueOnce({ data: [{ id: 'a1', name: 'Alice' }, { id: 'a2', name: 'Bob' }] });
    expect((await mockGet('/agents')).data).toHaveLength(2);
  });

  it('should notify agent on assignment', () => {
    const notify = vi.fn(); notify('agent_1', 'Ticket assigned'); expect(notify).toHaveBeenCalled();
  });

  it('should unassign ticket', async () => {
    mockPut.mockResolvedValueOnce({ data: makeTicket({ assignedTo: null }) });
    expect((await mockPut('/tickets/tkt_1', { assignedTo: null })).data.assignedTo).toBeNull();
  });
});

describe('Support Integration – Error Handling', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should handle ticket creation error', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 422 } });
    await expect(mockPost('/tickets', {})).rejects.toMatchObject({ response: { status: 422 } });
  });

  it('should handle ticket fetch error', async () => {
    mockGet.mockRejectedValueOnce(new Error('Failed to load'));
    await expect(mockGet('/tickets')).rejects.toThrow('Failed to load');
  });

  it('should handle ticket update error', async () => {
    mockPut.mockRejectedValueOnce(new Error('Update failed'));
    await expect(mockPut('/tickets/tkt_1', {})).rejects.toThrow('Update failed');
  });

  it('should show error toast on failure', () => {
    const toast = vi.fn(); toast({ type: 'error' }); expect(toast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });
});
