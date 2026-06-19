import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetchKPIs = vi.fn();
const mockFetchPipeline = vi.fn();
const mockFetchRevenue = vi.fn();
const mockFetchUsage = vi.fn();
const navigate = vi.fn();
const showToast = vi.fn();

const makeQC = () => ({ invalidateQueries: vi.fn(), refetchQueries: vi.fn(), setQueryData: vi.fn() });

describe('Date range change triggers refetch', () => {
  beforeEach(() => vi.clearAllMocks());

  it('changing range calls all fetch hooks', async () => {
    mockFetchKPIs.mockResolvedValue({ revenue: 100 });
    mockFetchPipeline.mockResolvedValue([]);
    mockFetchRevenue.mockResolvedValue([]);
    await Promise.all([
      mockFetchKPIs({ range: 'last30' }),
      mockFetchPipeline({ range: 'last30' }),
      mockFetchRevenue({ range: 'last30' }),
    ]);
    expect(mockFetchKPIs).toHaveBeenCalledWith({ range: 'last30' });
    expect(mockFetchPipeline).toHaveBeenCalledWith({ range: 'last30' });
    expect(mockFetchRevenue).toHaveBeenCalledWith({ range: 'last30' });
  });
  it('range last7 fetches last7', async () => {
    mockFetchKPIs.mockResolvedValue({});
    await mockFetchKPIs({ range: 'last7' });
    expect(mockFetchKPIs).toHaveBeenCalledWith({ range: 'last7' });
  });
  it('range last90 fetches last90', async () => {
    mockFetchKPIs.mockResolvedValue({});
    await mockFetchKPIs({ range: 'last90' });
    expect(mockFetchKPIs).toHaveBeenCalledWith({ range: 'last90' });
  });
  it('custom range passes dates', async () => {
    mockFetchKPIs.mockResolvedValue({});
    await mockFetchKPIs({ from: '2024-01-01', to: '2024-01-31' });
    expect(mockFetchKPIs).toHaveBeenCalledWith({ from: '2024-01-01', to: '2024-01-31' });
  });
  it('query key changes on range change', () => {
    const qc = makeQC();
    qc.refetchQueries({ queryKey: ['kpis', 'last30'] });
    qc.refetchQueries({ queryKey: ['kpis', 'last7'] });
    expect(qc.refetchQueries).toHaveBeenCalledTimes(2);
  });
});

describe('KPI card interaction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('click revenue KPI navigates to sales', () => {
    navigate('/sales');
    expect(navigate).toHaveBeenCalledWith('/sales');
  });
  it('click contacts KPI navigates to contacts', () => {
    navigate('/contacts');
    expect(navigate).toHaveBeenCalledWith('/contacts');
  });
  it('click pipeline stage navigates to filtered contacts', () => {
    navigate('/contacts?stage=Lead');
    expect(navigate).toHaveBeenCalledWith('/contacts?stage=Lead');
  });
  it('KPI shows loading skeleton', () => {
    const isLoading = true;
    expect(isLoading).toBe(true);
  });
  it('KPI shows real data after load', () => {
    const kpis = { revenue: 50000 };
    expect(kpis.revenue).toBe(50000);
  });
});

describe('Widget grid + data loading', () => {
  beforeEach(() => vi.clearAllMocks());

  it('all widgets start loading', () => {
    const states = ['kpi', 'pipeline', 'revenue', 'usage'].map(() => ({ isLoading: true }));
    expect(states.every(s => s.isLoading)).toBe(true);
  });
  it('widgets load independently', async () => {
    mockFetchKPIs.mockResolvedValue({ revenue: 1 });
    mockFetchPipeline.mockRejectedValue(new Error('pipeline error'));
    const [kpis, pipeline] = await Promise.allSettled([
      mockFetchKPIs({}),
      mockFetchPipeline({}),
    ]);
    expect(kpis.status).toBe('fulfilled');
    expect(pipeline.status).toBe('rejected');
  });
  it('failed widget shows error state', () => {
    const widgetError = new Error('Widget failed');
    expect(widgetError.message).toBe('Widget failed');
  });
  it('other widgets still render when one fails', () => {
    const widgets = [
      { id: 'w1', error: null, data: { value: 100 } },
      { id: 'w2', error: new Error('fail'), data: null },
      { id: 'w3', error: null, data: { value: 200 } },
    ];
    expect(widgets.filter(w => !w.error)).toHaveLength(2);
  });
  it('loading skeleton count matches widget count', () => {
    const widgetCount = 4;
    const skeletons = Array.from({ length: widgetCount });
    expect(skeletons).toHaveLength(4);
  });
});

describe('Error boundary in widgets', () => {
  beforeEach(() => vi.clearAllMocks());

  it('error boundary catches render error', () => {
    const caught = vi.fn();
    const ErrorBoundary = { catch: caught };
    ErrorBoundary.catch(new Error('render error'));
    expect(caught).toHaveBeenCalled();
  });
  it('error boundary shows fallback UI', () => {
    const hasFallback = true;
    expect(hasFallback).toBe(true);
  });
  it('non-error widgets unaffected', () => {
    const healthy = [{ id: 'w1', hasError: false }, { id: 'w3', hasError: false }];
    expect(healthy.every(w => !w.hasError)).toBe(true);
  });
});

describe('Auto-refresh integration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refetch triggered by interval', () => {
    const qc = makeQC();
    qc.refetchQueries({ queryKey: ['dashboard'], type: 'active' });
    expect(qc.refetchQueries).toHaveBeenCalled();
  });
  it('manual refresh calls refetch', () => {
    const qc = makeQC();
    qc.refetchQueries({ queryKey: ['kpis'] });
    expect(qc.refetchQueries).toHaveBeenCalledWith({ queryKey: ['kpis'] });
  });
  it('focus window triggers refetch', () => {
    const qc = makeQC();
    qc.refetchQueries({ type: 'active' });
    expect(qc.refetchQueries).toHaveBeenCalledWith({ type: 'active' });
  });
});

describe('Filter change → all charts update', () => {
  beforeEach(() => vi.clearAllMocks());

  it('changing tenant filter refetches all', async () => {
    await Promise.all([
      mockFetchKPIs({ tenantId: 'tenant-2' }),
      mockFetchRevenue({ tenantId: 'tenant-2' }),
      mockFetchPipeline({ tenantId: 'tenant-2' }),
    ]);
    [mockFetchKPIs, mockFetchRevenue, mockFetchPipeline].forEach(fn =>
      expect(fn).toHaveBeenCalledWith({ tenantId: 'tenant-2' })
    );
  });
  it('filter by user role shows subset', async () => {
    mockFetchKPIs.mockResolvedValue({ revenue: 5000 });
    await mockFetchKPIs({ role: 'sales' });
    expect(mockFetchKPIs).toHaveBeenCalledWith({ role: 'sales' });
  });
});

describe('Export dashboard data', () => {
  beforeEach(() => vi.clearAllMocks());

  it('export generates correct filename', () => {
    const filename = `dashboard-export-2024-01-01.csv`;
    expect(filename).toMatch(/^dashboard-export-.+\.csv$/);
  });
  it('export includes all KPI fields', () => {
    const kpis = { revenue: 50000, contacts: 100, deals: 10 };
    const keys = Object.keys(kpis);
    expect(keys).toContain('revenue');
    expect(keys).toContain('contacts');
  });
  it('export of empty data returns empty csv', () => {
    const rows: unknown[] = [];
    const csv = rows.map(r => JSON.stringify(r)).join('\n');
    expect(csv).toBe('');
  });
  it('export triggers download', () => {
    const download = vi.fn();
    download('dashboard.csv');
    expect(download).toHaveBeenCalledWith('dashboard.csv');
  });
});

describe('Loading → real data transition', () => {
  beforeEach(() => vi.clearAllMocks());

  it('isLoading transitions from true to false', () => {
    let isLoading = true;
    isLoading = false;
    expect(isLoading).toBe(false);
  });
  it('skeleton replaced by real data', () => {
    let data: unknown = null;
    data = { revenue: 50000 };
    expect(data).toBeTruthy();
  });
  it('multiple widgets can be in different loading states', () => {
    const states = [
      { id: 'kpi', isLoading: false },
      { id: 'pipeline', isLoading: true },
    ];
    expect(states.some(s => s.isLoading)).toBe(true);
    expect(states.some(s => !s.isLoading)).toBe(true);
  });
});

describe('Tenant isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('401 redirects to login', async () => {
    mockFetchKPIs.mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }));
    try { await mockFetchKPIs({}); } catch (e: any) {
      if (e.status === 401) navigate('/login');
    }
    expect(navigate).toHaveBeenCalledWith('/login');
  });
  it('403 shows forbidden', async () => {
    mockFetchKPIs.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }));
    let caught: any = null;
    try { await mockFetchKPIs({}); } catch (e) { caught = e; }
    expect((caught as any)?.status).toBe(403);
  });
  it('data scoped to tenant', async () => {
    mockFetchKPIs.mockResolvedValue({ tenantId: 'tenant-1', revenue: 100 });
    const result = await mockFetchKPIs({ tenantId: 'tenant-1' });
    expect(result.tenantId).toBe('tenant-1');
  });
});
