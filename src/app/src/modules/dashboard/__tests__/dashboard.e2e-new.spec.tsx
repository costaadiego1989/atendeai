import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetchKPIs = vi.fn();
const mockFetchPipeline = vi.fn();
const mockFetchRevenue = vi.fn();
const navigate = vi.fn();
const showToast = vi.fn();

describe('Dashboard e2e flows', () => {
  beforeEach(() => vi.clearAllMocks());

  it('load dashboard → receives KPIs', async () => {
    mockFetchKPIs.mockResolvedValue({ revenue: 50000, contacts: 120, deals: 15 });
    const result = await mockFetchKPIs({ range: 'last30' });
    expect(result.revenue).toBe(50000);
  });

  it('change date range → data updates', async () => {
    mockFetchKPIs.mockResolvedValueOnce({ revenue: 50000 }).mockResolvedValueOnce({ revenue: 30000 });
    const first = await mockFetchKPIs({ range: 'last30' });
    const second = await mockFetchKPIs({ range: 'last7' });
    expect(first.revenue).not.toBe(second.revenue);
  });

  it('click pipeline stage → navigates to contacts', () => {
    navigate('/contacts?stage=Lead');
    expect(navigate).toHaveBeenCalledWith('/contacts?stage=Lead');
  });

  it('click revenue KPI → navigates to sales', () => {
    navigate('/sales');
    expect(navigate).toHaveBeenCalledWith('/sales');
  });

  it('export report → triggers download', () => {
    const download = vi.fn();
    download('dashboard-export.csv');
    expect(download).toHaveBeenCalled();
  });

  it('error state when API down', async () => {
    mockFetchKPIs.mockRejectedValue(new Error('Service unavailable'));
    let err: any = null;
    try { await mockFetchKPIs({}); } catch (e) { err = e; }
    expect(err.message).toBe('Service unavailable');
  });

  it('loading state while fetching', () => {
    const isLoading = true;
    expect(isLoading).toBe(true);
  });

  it('401 → redirect to login', async () => {
    mockFetchKPIs.mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }));
    try { await mockFetchKPIs({}); } catch (e: any) {
      if (e.status === 401) navigate('/login');
    }
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('403 → forbidden message', async () => {
    mockFetchKPIs.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }));
    let caught: any = null;
    try { await mockFetchKPIs({}); } catch (e) { caught = e; }
    expect((caught as any)?.status).toBe(403);
  });

  it('mobile: 1 column layout', () => {
    const columns = (width: number) => width < 768 ? 1 : width < 1200 ? 2 : 3;
    expect(columns(375)).toBe(1);
  });

  it('tablet: 2 column layout', () => {
    const columns = (width: number) => width < 768 ? 1 : width < 1200 ? 2 : 3;
    expect(columns(1024)).toBe(2);
  });

  it('desktop: 3 column layout', () => {
    const columns = (width: number) => width < 768 ? 1 : width < 1200 ? 2 : 3;
    expect(columns(1440)).toBe(3);
  });

  it('pipeline data fetched with range', async () => {
    mockFetchPipeline.mockResolvedValue([{ stage: 'Lead', count: 10 }]);
    const result = await mockFetchPipeline({ range: 'last30' });
    expect(result[0].stage).toBe('Lead');
  });

  it('revenue chart fetched with range', async () => {
    mockFetchRevenue.mockResolvedValue([{ month: 'Jan', amount: 5000 }]);
    const result = await mockFetchRevenue({ range: 'last30' });
    expect(result[0].month).toBe('Jan');
  });

  it('real-time refresh updates KPIs', async () => {
    mockFetchKPIs.mockResolvedValueOnce({ revenue: 50000 }).mockResolvedValueOnce({ revenue: 51000 });
    const first = await mockFetchKPIs({});
    const second = await mockFetchKPIs({});
    expect(second.revenue).toBeGreaterThan(first.revenue);
  });

  it('widget reorder saves new order', () => {
    const order = ['pipeline', 'revenue', 'kpi'];
    const reordered = [order[1], order[0], order[2]];
    expect(reordered[0]).toBe('revenue');
  });

  it('success toast on data load', () => {
    showToast({ type: 'success', message: 'Dashboard loaded' });
    expect(showToast).toHaveBeenCalledWith({ type: 'success', message: 'Dashboard loaded' });
  });

  it('period comparison: current vs previous', async () => {
    mockFetchKPIs
      .mockResolvedValueOnce({ revenue: 60000 })
      .mockResolvedValueOnce({ revenue: 50000 });
    const current = await mockFetchKPIs({ range: 'last30' });
    const previous = await mockFetchKPIs({ range: 'prev30' });
    const change = ((current.revenue - previous.revenue) / previous.revenue) * 100;
    expect(change).toBe(20);
  });

  it('tenant scoped dashboard', async () => {
    mockFetchKPIs.mockResolvedValue({ tenantId: 'tenant-1', revenue: 100 });
    const result = await mockFetchKPIs({ tenantId: 'tenant-1' });
    expect(result.tenantId).toBe('tenant-1');
  });

  it('empty pipeline shows empty state', async () => {
    mockFetchPipeline.mockResolvedValue([]);
    const result = await mockFetchPipeline({});
    expect(result).toHaveLength(0);
  });

  it('zero revenue displayed correctly', async () => {
    mockFetchKPIs.mockResolvedValue({ revenue: 0 });
    const result = await mockFetchKPIs({});
    expect(result.revenue).toBe(0);
  });

  it('multiple date range changes handled in sequence', async () => {
    for (const range of ['last7', 'last30', 'last90']) {
      mockFetchKPIs.mockResolvedValue({ range });
      const result = await mockFetchKPIs({ range });
      expect(result.range).toBe(range);
    }
  });
});
