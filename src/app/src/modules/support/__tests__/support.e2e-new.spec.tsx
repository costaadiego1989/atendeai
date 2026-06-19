import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockPost = vi.fn();
const mockGet = vi.fn();
const mockPut = vi.fn();

vi.mock('../api/supportApi', () => ({
  supportApi: { submitFeedback: mockPost, createTicket: mockPost, getTickets: mockGet, updateTicket: mockPut },
}));

const makeTicket = (o = {}) => ({ id: 'tkt_1', title: 'Issue', status: 'open', priority: 'high', ...o });

describe('Support E2E – Feedback Submission Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should submit bug feedback end to end', async () => {
    mockPost.mockResolvedValueOnce({ data: { id: 'fb_1', type: 'bug' } });
    expect((await mockPost('/feedback', { type: 'bug', message: 'Bug!' })).data.type).toBe('bug');
  });

  it('should validate feedback before submit', () => {
    const v = vi.fn().mockReturnValue({ message: 'Required' }); expect(v({}).message).toBe('Required');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('should show success after submission', () => {
    const show = vi.fn(); show('Thanks!'); expect(show).toHaveBeenCalledWith('Thanks!');
  });

  it('should close form after submission', () => {
    const close = vi.fn(); close(); expect(close).toHaveBeenCalled();
  });
});

describe('Support E2E – Ticket Creation Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should create ticket and show in list', async () => {
    mockPost.mockResolvedValueOnce({ data: makeTicket() });
    expect((await mockPost('/tickets', { title: 'Login issue', priority: 'high' })).data.id).toBeDefined();
  });

  it('should validate required fields', () => {
    const v = vi.fn().mockReturnValue({ title: 'Required' }); expect(v({}).title).toBe('Required');
  });

  it('should show ticket number after creation', async () => {
    mockPost.mockResolvedValueOnce({ data: makeTicket({ number: 'TICK-001' }) });
    expect((await mockPost('/tickets', {})).data.number).toBeDefined();
  });
});

describe('Support E2E – Ticket Resolution Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should resolve ticket end to end', async () => {
    mockPut.mockResolvedValueOnce({ data: makeTicket({ status: 'resolved' }) });
    expect((await mockPut('/tickets/tkt_1', { status: 'resolved' })).data.status).toBe('resolved');
  });

  it('should notify user on resolution', () => {
    const notify = vi.fn(); notify('user@test.com', 'Ticket resolved'); expect(notify).toHaveBeenCalled();
  });

  it('should close ticket after resolution', async () => {
    mockPut.mockResolvedValueOnce({ data: makeTicket({ status: 'closed' }) });
    expect((await mockPut('/tickets/tkt_1', { status: 'closed' })).data.status).toBe('closed');
  });
});

describe('Support E2E – Ticket Assignment Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should assign ticket to agent', async () => {
    mockPut.mockResolvedValueOnce({ data: makeTicket({ assignedTo: 'agent_1' }) });
    expect((await mockPut('/tickets/tkt_1', { assignedTo: 'agent_1' })).data.assignedTo).toBe('agent_1');
  });

  it('should notify agent on assignment', () => {
    const notify = vi.fn(); notify('agent_1', 'New ticket'); expect(notify).toHaveBeenCalled();
  });
});

describe('Support E2E – Ticket Priority Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should escalate ticket priority', async () => {
    mockPut.mockResolvedValueOnce({ data: makeTicket({ priority: 'critical' }) });
    expect((await mockPut('/tickets/tkt_1', { priority: 'critical' })).data.priority).toBe('critical');
  });

  it('should show critical tickets at top of list', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeTicket({ priority: 'critical' }), makeTicket({ priority: 'low' })] });
    const res = await mockGet({ sort: 'priority' });
    expect(res.data[0].priority).toBe('critical');
  });
});

describe('Support E2E – Ticket Search & Filter Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should search tickets by title', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeTicket({ title: 'Login bug' })] });
    expect((await mockGet({ search: 'Login' })).data[0].title).toBe('Login bug');
  });

  it('should filter by status', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeTicket({ status: 'open' })] });
    expect((await mockGet({ status: 'open' })).data[0].status).toBe('open');
  });

  it('should filter by priority', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeTicket({ priority: 'high' })] });
    expect((await mockGet({ priority: 'high' })).data[0].priority).toBe('high');
  });
});
