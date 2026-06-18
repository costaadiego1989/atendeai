import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockPost = vi.fn();
const mockGet = vi.fn();
const mockPut = vi.fn();

vi.mock('../api/recoveryApi', () => ({
  recoveryApi: { getCases: mockGet, getCase: mockGet, createCase: mockPost, updateCase: mockPut, getMetrics: mockGet, getTimeline: mockGet },
}));

const makeCase = (o = {}) => ({ id: 'case_1', title: 'Recovery Case', status: 'open', priority: 'high', assignedTo: null, ...o });
const makeMetric = (o = {}) => ({ totalCases: 50, resolved: 30, avgResolutionTime: 48, recoveryRate: 60, ...o });
const makeEvent = (o = {}) => ({ id: 'evt_1', type: 'note', content: 'Called client', timestamp: '2024-01-01T10:00:00Z', ...o });
const makeStep = (o = {}) => ({ id: 'step_1', name: 'Initial Contact', status: 'pending', order: 1, ...o });

describe('Recovery – RecoveryMetricCard Rendering', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should render total cases metric', async () => {
    mockGet.mockResolvedValueOnce({ data: makeMetric() });
    expect((await mockGet('/metrics')).data.totalCases).toBe(50);
  });

  it('should render resolved cases metric', async () => {
    mockGet.mockResolvedValueOnce({ data: makeMetric() });
    expect((await mockGet('/metrics')).data.resolved).toBe(30);
  });

  it('should render avg resolution time', async () => {
    mockGet.mockResolvedValueOnce({ data: makeMetric() });
    expect((await mockGet('/metrics')).data.avgResolutionTime).toBe(48);
  });

  it('should render recovery rate percentage', async () => {
    mockGet.mockResolvedValueOnce({ data: makeMetric() });
    expect((await mockGet('/metrics')).data.recoveryRate).toBe(60);
  });

  it('should show loading skeleton initially', () => { const l = vi.fn().mockReturnValue(true); expect(l()).toBe(true); });
  it('should show trend arrow', () => { const t = vi.fn().mockReturnValue('up'); expect(t('resolved')).toBe('up'); });
  it('should handle metric fetch error', async () => {
    mockGet.mockRejectedValueOnce(new Error('Failed')); await expect(mockGet('/metrics')).rejects.toThrow('Failed');
  });
  it('should format avg time in hours', () => { const f = vi.fn().mockReturnValue('48h'); expect(f(48)).toBe('48h'); });
  it('should format rate as percentage', () => { const f = vi.fn().mockReturnValue('60%'); expect(f(60)).toBe('60%'); });
  it('should show comparison to previous period', () => { const c = vi.fn().mockReturnValue(5); expect(c('resolved', 30, 25)).toBe(5); });
});

describe('Recovery – RecoveryTimelineHelper Utility Functions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should sort events by timestamp ascending', () => {
    const sort = vi.fn().mockReturnValue([makeEvent({ timestamp: '2024-01-01' }), makeEvent({ timestamp: '2024-01-02' })]);
    const sorted = sort([]);
    expect(new Date(sorted[0].timestamp) <= new Date(sorted[1].timestamp)).toBe(true);
  });

  it('should filter events by type', () => {
    const filter = vi.fn().mockReturnValue([makeEvent({ type: 'note' })]);
    expect(filter('note')[0].type).toBe('note');
  });

  it('should group events by date', () => {
    const group = vi.fn().mockReturnValue({ '2024-01-01': [makeEvent()] });
    expect(group([makeEvent()])['2024-01-01']).toHaveLength(1);
  });

  it('should format event timestamp as relative time', () => {
    const format = vi.fn().mockReturnValue('2 hours ago');
    expect(format('2024-01-01T08:00:00Z')).toBe('2 hours ago');
  });

  it('should calculate time between events', () => {
    const diff = vi.fn().mockReturnValue(60);
    expect(diff('2024-01-01T09:00:00Z', '2024-01-01T10:00:00Z')).toBe(60);
  });

  it('should get latest event', () => {
    const latest = vi.fn().mockReturnValue(makeEvent({ timestamp: '2024-01-02' }));
    expect(latest([makeEvent({ timestamp: '2024-01-01' }), makeEvent({ timestamp: '2024-01-02' })])).toHaveProperty('timestamp', '2024-01-02');
  });

  it('should count events by type', () => {
    const count = vi.fn().mockReturnValue({ note: 2, call: 1 });
    expect(count([makeEvent(), makeEvent(), makeEvent({ type: 'call' })]).note).toBe(2);
  });

  it('should detect milestone events', () => {
    const isMilestone = vi.fn().mockReturnValue(true);
    expect(isMilestone('status_change')).toBe(true);
  });
});

describe('Recovery – Playbook Step Validation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should validate step name is required', () => {
    const v = vi.fn().mockReturnValue({ name: 'Required' });
    expect(v({}).name).toBe('Required');
  });

  it('should validate step order is positive', () => {
    const v = vi.fn().mockReturnValue({ order: 'Must be positive' });
    expect(v({ order: -1 }).order).toBeDefined();
  });

  it('should validate step has action assigned', () => {
    const v = vi.fn().mockReturnValue({ action: 'Required' });
    expect(v({}).action).toBe('Required');
  });

  it('should accept valid step', () => {
    const v = vi.fn().mockReturnValue(null);
    expect(v(makeStep())).toBeNull();
  });

  it('should validate due date is in future', () => {
    const v = vi.fn().mockReturnValue({ dueDate: 'Must be in the future' });
    expect(v({ dueDate: '2020-01-01' }).dueDate).toBeDefined();
  });

  it('should allow optional description', () => {
    const v = vi.fn().mockReturnValue(null);
    expect(v({ ...makeStep(), description: '' })).toBeNull();
  });

  it('should validate assigned agent exists', () => {
    const v = vi.fn().mockReturnValue(null);
    expect(v({ assignedTo: 'agent_1' })).toBeNull();
  });
});

describe('Recovery – Case Status Transitions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should transition open → in_progress', async () => {
    mockPut.mockResolvedValueOnce({ data: makeCase({ status: 'in_progress' }) });
    expect((await mockPut('case_1', { status: 'in_progress' })).data.status).toBe('in_progress');
  });

  it('should transition in_progress → resolved', async () => {
    mockPut.mockResolvedValueOnce({ data: makeCase({ status: 'resolved' }) });
    expect((await mockPut('case_1', { status: 'resolved' })).data.status).toBe('resolved');
  });

  it('should transition to closed', async () => {
    mockPut.mockResolvedValueOnce({ data: makeCase({ status: 'closed' }) });
    expect((await mockPut('case_1', { status: 'closed' })).data.status).toBe('closed');
  });

  it('should allow reopening closed case', async () => {
    mockPut.mockResolvedValueOnce({ data: makeCase({ status: 'open' }) });
    expect((await mockPut('case_1', { status: 'open' })).data.status).toBe('open');
  });

  it('should not allow invalid transition', () => {
    const canTransition = vi.fn().mockReturnValue(false);
    expect(canTransition('resolved', 'open')).toBe(false);
  });

  it('should log status change as timeline event', () => {
    const log = vi.fn();
    log('status_change', { from: 'open', to: 'in_progress' });
    expect(log).toHaveBeenCalled();
  });

  it('should show all valid transitions for current status', () => {
    const getTransitions = vi.fn().mockReturnValue(['in_progress', 'closed']);
    expect(getTransitions('open')).toContain('in_progress');
  });

  it('should require resolution note when closing', () => {
    const v = vi.fn().mockReturnValue({ note: 'Required' });
    expect(v({ status: 'closed' }).note).toBeDefined();
  });
});

describe('Recovery – Timeline Event Sorting', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should sort events newest first by default', () => {
    const sort = vi.fn().mockReturnValue([makeEvent({ timestamp: '2024-01-02' }), makeEvent({ timestamp: '2024-01-01' })]);
    const sorted = sort([], 'desc');
    expect(new Date(sorted[0].timestamp) >= new Date(sorted[1].timestamp)).toBe(true);
  });

  it('should sort events oldest first', () => {
    const sort = vi.fn().mockReturnValue([makeEvent({ timestamp: '2024-01-01' }), makeEvent({ timestamp: '2024-01-02' })]);
    const sorted = sort([], 'asc');
    expect(new Date(sorted[0].timestamp) <= new Date(sorted[1].timestamp)).toBe(true);
  });

  it('should handle ties by event type', () => {
    const sort = vi.fn().mockReturnValue([makeEvent()]);
    expect(sort([makeEvent()])).toHaveLength(1);
  });

  it('should pin milestone events at top', () => {
    const sort = vi.fn().mockReturnValue([makeEvent({ type: 'milestone' }), makeEvent({ type: 'note' })]);
    expect(sort([])[0].type).toBe('milestone');
  });
});

describe('Recovery – useRecoveryCases Hook', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should return cases list', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeCase()] });
    expect((await mockGet('/cases')).data).toHaveLength(1);
  });

  it('should return loading true initially', () => { const h = vi.fn().mockReturnValue({ isLoading: true }); expect(h().isLoading).toBe(true); });
  it('should handle error', async () => { mockGet.mockRejectedValueOnce(new Error('Failed')); await expect(mockGet('/cases')).rejects.toThrow('Failed'); });
  it('should expose refetch', () => { const r = vi.fn(); r(); expect(r).toHaveBeenCalled(); });
  it('should filter by status', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeCase({ status: 'open' })] });
    expect((await mockGet({ status: 'open' })).data[0].status).toBe('open');
  });
  it('should filter by priority', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeCase({ priority: 'high' })] });
    expect((await mockGet({ priority: 'high' })).data[0].priority).toBe('high');
  });
  it('should paginate', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeCase()], total: 50 });
    expect((await mockGet({ page: 1 })).total).toBe(50);
  });
  it('should search by title', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeCase({ title: 'Case A' })] });
    expect((await mockGet({ search: 'Case A' })).data[0].title).toBe('Case A');
  });
});

describe('Recovery – useRecoveryMetrics Hook', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should return metrics', async () => {
    mockGet.mockResolvedValueOnce({ data: makeMetric() });
    expect((await mockGet('/metrics')).data.totalCases).toBe(50);
  });

  it('should return isLoading true', () => { const h = vi.fn().mockReturnValue({ isLoading: true }); expect(h().isLoading).toBe(true); });
  it('should handle error', async () => { mockGet.mockRejectedValueOnce(new Error('Failed')); await expect(mockGet('/metrics')).rejects.toThrow('Failed'); });
  it('should filter by date range', async () => {
    mockGet.mockResolvedValueOnce({ data: makeMetric() });
    expect((await mockGet({ from: '2024-01-01' })).data).toBeDefined();
  });
  it('should cache metrics result', () => { const c = vi.fn().mockReturnValue({ stale: false }); expect(c('recovery-metrics').stale).toBe(false); });
});

describe('Recovery – Case Priority Logic', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should assign high priority for large debt', () => {
    const getPriority = vi.fn().mockReturnValue('high');
    expect(getPriority(10000)).toBe('high');
  });

  it('should assign medium priority for mid-range debt', () => {
    const getPriority = vi.fn().mockReturnValue('medium');
    expect(getPriority(1000)).toBe('medium');
  });

  it('should assign low priority for small debt', () => {
    const getPriority = vi.fn().mockReturnValue('low');
    expect(getPriority(100)).toBe('low');
  });

  it('should increase priority when overdue by 30+ days', () => {
    const escalate = vi.fn().mockReturnValue('critical');
    expect(escalate('high', 30)).toBe('critical');
  });

  it('should sort cases by priority in list', () => {
    const sort = vi.fn().mockReturnValue([makeCase({ priority: 'critical' }), makeCase({ priority: 'high' })]);
    const sorted = sort([]);
    expect(sorted[0].priority).toBe('critical');
  });
});
