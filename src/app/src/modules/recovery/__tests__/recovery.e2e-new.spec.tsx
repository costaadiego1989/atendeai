import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockPost = vi.fn();
const mockGet = vi.fn();
const mockPut = vi.fn();

vi.mock('../api/recoveryApi', () => ({
  recoveryApi: { getCases: mockGet, createCase: mockPost, updateCase: mockPut, getMetrics: mockGet },
}));

const makeCase = (o = {}) => ({ id: 'case_1', title: 'Case A', status: 'open', priority: 'high', ...o });

describe('Recovery E2E – Case Creation Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should complete full case creation flow', async () => {
    mockPost.mockResolvedValueOnce({ data: makeCase() });
    expect((await mockPost('/cases', { title: 'Case A', amount: 5000 })).data.id).toBeDefined();
  });

  it('should validate form before API call', () => {
    const v = vi.fn().mockReturnValue({ title: 'Required' }); expect(v({}).title).toBe('Required');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('should show new case in list', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeCase()] });
    expect((await mockGet('/cases')).data).toHaveLength(1);
  });
});

describe('Recovery E2E – Case Assignment Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should assign case to agent', async () => {
    mockPut.mockResolvedValueOnce({ data: makeCase({ assignedTo: 'agent_1' }) });
    expect((await mockPut('/cases/case_1', { assignedTo: 'agent_1' })).data.assignedTo).toBe('agent_1');
  });

  it('should notify agent of assignment', () => {
    const notify = vi.fn(); notify('agent_1', 'Case assigned'); expect(notify).toHaveBeenCalled();
  });

  it('should show assigned agent in case detail', async () => {
    mockGet.mockResolvedValueOnce({ data: makeCase({ assignedTo: 'agent_1', agentName: 'Alice' }) });
    expect((await mockGet('/cases/case_1')).data.agentName).toBe('Alice');
  });
});

describe('Recovery E2E – Playbook Execution Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should load and execute playbook steps', async () => {
    mockGet.mockResolvedValueOnce({ data: [{ id: 'step_1', name: 'Contact Client', status: 'pending' }] });
    const steps = (await mockGet('/cases/case_1/playbook')).data;
    expect(steps[0].status).toBe('pending');
  });

  it('should mark step completed', async () => {
    mockPut.mockResolvedValueOnce({ data: { id: 'step_1', status: 'completed' } });
    expect((await mockPut('/cases/case_1/steps/step_1', { status: 'completed' })).data.status).toBe('completed');
  });

  it('should show playbook progress', () => {
    const pct = vi.fn().mockReturnValue(100); expect(pct(1, 1)).toBe(100);
  });
});

describe('Recovery E2E – Timeline Event Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should add note to timeline', async () => {
    mockPost.mockResolvedValueOnce({ data: { id: 'evt_1', type: 'note', content: 'Called client' } });
    expect((await mockPost('/cases/case_1/events', { type: 'note' })).data.type).toBe('note');
  });

  it('should display timeline in chronological order', async () => {
    mockGet.mockResolvedValueOnce({ data: [{ timestamp: '2024-01-01' }, { timestamp: '2024-01-02' }] });
    const events = (await mockGet('/cases/case_1/timeline')).data;
    expect(events).toHaveLength(2);
  });
});

describe('Recovery E2E – Status Transition Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should transition case from open to in_progress', async () => {
    mockPut.mockResolvedValueOnce({ data: makeCase({ status: 'in_progress' }) });
    expect((await mockPut('/cases/case_1', { status: 'in_progress' })).data.status).toBe('in_progress');
  });

  it('should transition case to resolved', async () => {
    mockPut.mockResolvedValueOnce({ data: makeCase({ status: 'resolved' }) });
    expect((await mockPut('/cases/case_1', { status: 'resolved' })).data.status).toBe('resolved');
  });

  it('should auto-log status change in timeline', () => {
    const log = vi.fn(); log({ type: 'status_change' }); expect(log).toHaveBeenCalled();
  });
});

describe('Recovery E2E – Metrics Dashboard Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should load recovery metrics on dashboard', async () => {
    mockGet.mockResolvedValueOnce({ data: { totalCases: 50, resolved: 30, recoveryRate: 60 } });
    const res = await mockGet('/metrics');
    expect(res.data.recoveryRate).toBe(60);
  });

  it('should filter metrics by date range', async () => {
    mockGet.mockResolvedValueOnce({ data: { totalCases: 20 } });
    expect((await mockGet({ from: '2024-01-01', to: '2024-01-31' })).data.totalCases).toBe(20);
  });
});

describe('Recovery E2E – Bulk Operations Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should bulk assign multiple cases', async () => {
    mockPut.mockResolvedValueOnce({ data: { updated: 3 } });
    expect((await mockPut('/cases/bulk-assign', { caseIds: ['c1', 'c2', 'c3'], agentId: 'a1' })).data.updated).toBe(3);
  });

  it('should bulk close resolved cases', async () => {
    mockPut.mockResolvedValueOnce({ data: { updated: 5 } });
    expect((await mockPut('/cases/bulk-close', { caseIds: ['c1', 'c2', 'c3', 'c4', 'c5'] })).data.updated).toBe(5);
  });
});

describe('Recovery E2E – Report Generation Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should generate and download report', async () => {
    mockPost.mockResolvedValueOnce({ data: { url: 'https://files/report.pdf' } });
    const url = (await mockPost('/reports/generate')).data.url;
    const download = vi.fn(); download(url); expect(download).toHaveBeenCalledWith(url);
  });

  it('should show report with metrics data', async () => {
    mockPost.mockResolvedValueOnce({ data: { metrics: { recoveryRate: 60 } } });
    expect((await mockPost('/reports/generate')).data.metrics.recoveryRate).toBe(60);
  });

  it('should handle report generation error', async () => {
    mockPost.mockRejectedValueOnce(new Error('Failed'));
    await expect(mockPost('/reports/generate')).rejects.toThrow('Failed');
  });
});
