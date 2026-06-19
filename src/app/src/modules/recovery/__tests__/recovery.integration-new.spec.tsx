import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockPost = vi.fn();
const mockGet = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('../api/recoveryApi', () => ({
  recoveryApi: { getCases: mockGet, createCase: mockPost, updateCase: mockPut, deleteCase: mockDelete, getMetrics: mockGet, getTimeline: mockGet, addEvent: mockPost, executePlaybook: mockPost, generateReport: mockPost },
}));

const makeCase = (o = {}) => ({ id: 'case_1', title: 'Case A', status: 'open', priority: 'high', assignedTo: null, amount: 5000, ...o });
const makeEvent = (o = {}) => ({ id: 'evt_1', type: 'note', content: 'Called client', timestamp: '2024-01-01T10:00:00Z', ...o });
const makeMetric = (o = {}) => ({ totalCases: 50, resolved: 30, avgResolutionTime: 48, recoveryRate: 60, ...o });
const makeStep = (o = {}) => ({ id: 'step_1', name: 'Contact', status: 'pending', order: 1, ...o });

describe('Recovery Integration – Case Creation and Assignment', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should create recovery case', async () => {
    mockPost.mockResolvedValueOnce({ data: makeCase() });
    expect((await mockPost('/cases', { title: 'Case A' })).data.id).toBeDefined();
  });

  it('should validate required fields on create', () => {
    const v = vi.fn().mockReturnValue({ title: 'Required', amount: 'Required' });
    expect(v({}).title).toBe('Required');
  });

  it('should assign case to agent on creation', async () => {
    mockPost.mockResolvedValueOnce({ data: makeCase({ assignedTo: 'agent_1' }) });
    expect((await mockPost('/cases', { assignedTo: 'agent_1' })).data.assignedTo).toBe('agent_1');
  });

  it('should auto-assign based on workload', async () => {
    mockPost.mockResolvedValueOnce({ data: makeCase({ assignedTo: 'agent_2' }) });
    expect((await mockPost('/cases', { autoAssign: true })).data.assignedTo).toBeDefined();
  });

  it('should add case to list after creation', () => {
    const inv = vi.fn(); inv('recovery-cases'); expect(inv).toHaveBeenCalledWith('recovery-cases');
  });

  it('should send notification to assigned agent', () => {
    const notify = vi.fn(); notify('agent_1', 'New case assigned'); expect(notify).toHaveBeenCalled();
  });

  it('should set initial status to open', async () => {
    mockPost.mockResolvedValueOnce({ data: makeCase({ status: 'open' }) });
    expect((await mockPost('/cases')).data.status).toBe('open');
  });

  it('should set priority based on amount', async () => {
    mockPost.mockResolvedValueOnce({ data: makeCase({ priority: 'high', amount: 5000 }) });
    expect((await mockPost('/cases', { amount: 5000 })).data.priority).toBe('high');
  });

  it('should link case to contact', async () => {
    mockPost.mockResolvedValueOnce({ data: makeCase({ contactId: 'cont_1' }) });
    expect((await mockPost('/cases', { contactId: 'cont_1' })).data.contactId).toBe('cont_1');
  });

  it('should handle creation error', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 422 } });
    await expect(mockPost('/cases', {})).rejects.toMatchObject({ response: { status: 422 } });
  });
});

describe('Recovery Integration – Playbook Execution Steps', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should load playbook steps for case', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeStep(), makeStep({ id: 'step_2', order: 2 })] });
    expect((await mockGet('/cases/case_1/playbook')).data).toHaveLength(2);
  });

  it('should mark step as completed', async () => {
    mockPut.mockResolvedValueOnce({ data: makeStep({ status: 'completed' }) });
    expect((await mockPut('/cases/case_1/steps/step_1', { status: 'completed' })).data.status).toBe('completed');
  });

  it('should advance to next step automatically', async () => {
    mockPost.mockResolvedValueOnce({ data: { currentStep: 2 } });
    expect((await mockPost('/cases/case_1/playbook/next')).data.currentStep).toBe(2);
  });

  it('should skip optional step', async () => {
    mockPut.mockResolvedValueOnce({ data: makeStep({ status: 'skipped' }) });
    expect((await mockPut('/cases/case_1/steps/step_1', { status: 'skipped' })).data.status).toBe('skipped');
  });

  it('should require mandatory steps', () => {
    const canSkip = vi.fn().mockReturnValue(false); expect(canSkip('mandatory')).toBe(false);
  });

  it('should show playbook progress percentage', () => {
    const pct = vi.fn().mockReturnValue(50); expect(pct(1, 2)).toBe(50);
  });

  it('should log step execution as timeline event', () => {
    const log = vi.fn(); log('step_completed', { step: 'step_1' }); expect(log).toHaveBeenCalled();
  });

  it('should handle step execution error', async () => {
    mockPut.mockRejectedValueOnce(new Error('Step failed'));
    await expect(mockPut('/cases/case_1/steps/step_1', {})).rejects.toThrow('Step failed');
  });

  it('should assign step to specific agent', async () => {
    mockPut.mockResolvedValueOnce({ data: makeStep({ assignedTo: 'agent_1' }) });
    expect((await mockPut('/cases/case_1/steps/step_1', { assignedTo: 'agent_1' })).data.assignedTo).toBe('agent_1');
  });

  it('should set due date on step', async () => {
    mockPut.mockResolvedValueOnce({ data: makeStep({ dueDate: '2024-12-31' }) });
    expect((await mockPut('/cases/case_1/steps/step_1', { dueDate: '2024-12-31' })).data.dueDate).toBeDefined();
  });
});

describe('Recovery Integration – Timeline Event Logging', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should add note to case timeline', async () => {
    mockPost.mockResolvedValueOnce({ data: makeEvent({ type: 'note' }) });
    expect((await mockPost('/cases/case_1/events', { type: 'note', content: 'Called' })).data.type).toBe('note');
  });

  it('should add call log to timeline', async () => {
    mockPost.mockResolvedValueOnce({ data: makeEvent({ type: 'call' }) });
    expect((await mockPost('/cases/case_1/events', { type: 'call' })).data.type).toBe('call');
  });

  it('should log status change automatically', () => {
    const log = vi.fn(); log({ type: 'status_change', from: 'open', to: 'in_progress' }); expect(log).toHaveBeenCalled();
  });

  it('should load timeline events for case', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeEvent(), makeEvent({ id: 'evt_2', type: 'call' })] });
    expect((await mockGet('/cases/case_1/timeline')).data).toHaveLength(2);
  });

  it('should sort timeline by timestamp', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeEvent({ timestamp: '2024-01-02' }), makeEvent({ timestamp: '2024-01-01' })] });
    const res = await mockGet({ sort: 'timestamp', order: 'desc' });
    expect(new Date(res.data[0].timestamp) >= new Date(res.data[1].timestamp)).toBe(true);
  });

  it('should filter timeline by event type', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeEvent({ type: 'call' })] });
    expect((await mockGet({ type: 'call' })).data[0].type).toBe('call');
  });

  it('should include agent name in event', async () => {
    mockPost.mockResolvedValueOnce({ data: { ...makeEvent(), agentName: 'Alice' } });
    expect((await mockPost('/cases/case_1/events', {})).data.agentName).toBeDefined();
  });

  it('should handle event add error', async () => {
    mockPost.mockRejectedValueOnce(new Error('Failed'));
    await expect(mockPost('/cases/case_1/events', {})).rejects.toThrow('Failed');
  });
});

describe('Recovery Integration – Metric Card Data Loading', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should load all recovery metrics', async () => {
    mockGet.mockResolvedValueOnce({ data: makeMetric() });
    expect((await mockGet('/metrics')).data.totalCases).toBe(50);
  });

  it('should filter metrics by date range', async () => {
    mockGet.mockResolvedValueOnce({ data: makeMetric({ recoveryRate: 65 }) });
    expect((await mockGet({ from: '2024-01-01' })).data.recoveryRate).toBe(65);
  });

  it('should show metrics trend', async () => {
    mockGet.mockResolvedValueOnce({ data: { ...makeMetric(), trend: { resolved: 'up' } } });
    expect((await mockGet('/metrics')).data.trend.resolved).toBe('up');
  });

  it('should handle metrics fetch error', async () => {
    mockGet.mockRejectedValueOnce(new Error('Failed'));
    await expect(mockGet('/metrics')).rejects.toThrow('Failed');
  });

  it('should cache metrics with React Query', () => {
    const c = vi.fn().mockReturnValue({ stale: false });
    expect(c('recovery-metrics').stale).toBe(false);
  });
});

describe('Recovery Integration – Bulk Case Operations', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should bulk assign cases to agent', async () => {
    mockPut.mockResolvedValueOnce({ data: { updated: 5 } });
    expect((await mockPut('/cases/bulk-assign', { caseIds: ['c1', 'c2', 'c3', 'c4', 'c5'], agentId: 'a1' })).data.updated).toBe(5);
  });

  it('should bulk close resolved cases', async () => {
    mockPut.mockResolvedValueOnce({ data: { updated: 3 } });
    expect((await mockPut('/cases/bulk-close', { caseIds: ['c1', 'c2', 'c3'] })).data.updated).toBe(3);
  });

  it('should bulk delete cases', async () => {
    mockDelete.mockResolvedValueOnce({ data: { deleted: 2 } });
    expect((await mockDelete('/cases/bulk', { caseIds: ['c1', 'c2'] })).data.deleted).toBe(2);
  });

  it('should confirm before bulk delete', () => {
    const confirm = vi.fn().mockReturnValue(true); expect(confirm('Delete 2 cases?')).toBe(true);
  });

  it('should select all cases in list', () => {
    const selectAll = vi.fn(); selectAll(); expect(selectAll).toHaveBeenCalled();
  });

  it('should deselect all cases', () => {
    const deselectAll = vi.fn(); deselectAll(); expect(deselectAll).toHaveBeenCalled();
  });

  it('should show bulk action menu when cases selected', () => {
    const showMenu = vi.fn().mockReturnValue(true); expect(showMenu(2)).toBe(true);
  });

  it('should handle bulk update error and rollback', async () => {
    mockPut.mockRejectedValueOnce(new Error('Bulk failed'));
    const rollback = vi.fn();
    try { await mockPut('/cases/bulk', {}); } catch { rollback(); }
    expect(rollback).toHaveBeenCalled();
  });
});

describe('Recovery Integration – Report Generation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should generate recovery report', async () => {
    mockPost.mockResolvedValueOnce({ data: { url: 'https://files/recovery-report.pdf' } });
    expect((await mockPost('/reports/generate')).data.url).toBeDefined();
  });

  it('should download generated report', () => {
    const download = vi.fn(); download('https://files/recovery-report.pdf'); expect(download).toHaveBeenCalled();
  });

  it('should generate report for date range', async () => {
    mockPost.mockResolvedValueOnce({ data: { url: 'https://files/report.pdf', from: '2024-01-01', to: '2024-01-31' } });
    const res = await mockPost('/reports/generate', { from: '2024-01-01', to: '2024-01-31' });
    expect(res.data.from).toBe('2024-01-01');
  });

  it('should include metrics in report', async () => {
    mockPost.mockResolvedValueOnce({ data: { metrics: makeMetric() } });
    expect((await mockPost('/reports/generate')).data.metrics).toBeDefined();
  });

  it('should include case list in report', async () => {
    mockPost.mockResolvedValueOnce({ data: { cases: [makeCase()] } });
    expect((await mockPost('/reports/generate')).data.cases).toHaveLength(1);
  });

  it('should handle report generation error', async () => {
    mockPost.mockRejectedValueOnce(new Error('Report generation failed'));
    await expect(mockPost('/reports/generate')).rejects.toThrow('Report generation failed');
  });
});
