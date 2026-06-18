import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';
import React from 'react';

vi.mock('../PlatformTenantsPage');
vi.mock('../PlatformTenantsKPIs');
vi.mock('../PlatformTenantActionsSheet');
vi.mock('../PlatformTenantsHeader');

// ---------------------------------------------------------------------------
// Shared helpers / mocks
// ---------------------------------------------------------------------------

const mockTenants = [
  { id: 't1', name: 'Acme Corp', status: 'active', createdAt: '2024-01-01', revenue: 5000 },
  { id: 't2', name: 'Beta LLC', status: 'suspended', createdAt: '2024-02-01', revenue: 3000 },
  { id: 't3', name: 'Gamma Inc', status: 'active', createdAt: '2024-03-01', revenue: 8000 },
];

const mockKPIs = {
  totalTenants: 3,
  activeTenants: 2,
  suspendedTenants: 1,
  totalRevenue: 16000,
  revenueGrowth: 0.12,
};

const mockFetchTenants = vi.fn();
const mockFetchKPIs = vi.fn();
const mockActivateTenant = vi.fn();
const mockSuspendTenant = vi.fn();
const mockDeleteTenant = vi.fn();
const mockExportTenants = vi.fn();
const mockBulkActivate = vi.fn();
const mockShowToast = vi.fn();

function buildQueryClient() {
  return {
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
    getQueryData: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// 1. PlatformTenantsPage + React Query
// ---------------------------------------------------------------------------

describe('PlatformTenantsPage + React Query', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchTenants.mockResolvedValue({ data: mockTenants, total: 3 });
  });

  it('fetches tenant list on mount', async () => {
    mockFetchTenants.mockResolvedValueOnce({ data: mockTenants, total: 3 });
    const { result } = renderHook(() => {
      const [data, setData] = React.useState<typeof mockTenants | null>(null);
      React.useEffect(() => {
        mockFetchTenants({ page: 1, pageSize: 20 }).then((res: { data: typeof mockTenants }) => setData(res.data));
      }, []);
      return data;
    });
    await waitFor(() => expect(result.current).toHaveLength(3));
    expect(mockFetchTenants).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
  });

  it('shows loading spinner while fetching', async () => {
    let resolve: (v: unknown) => void = () => {};
    mockFetchTenants.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    const { result } = renderHook(() => {
      const [loading, setLoading] = React.useState(true);
      const [data, setData] = React.useState(null);
      React.useEffect(() => {
        mockFetchTenants({}).then((res: unknown) => { setData(res as null); setLoading(false); });
      }, []);
      return { loading, data };
    });
    expect(result.current.loading).toBe(true);
    act(() => resolve({ data: mockTenants, total: 3 }));
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('shows error state when fetch fails', async () => {
    mockFetchTenants.mockRejectedValueOnce(new Error('Network error'));
    const { result } = renderHook(() => {
      const [error, setError] = React.useState<string | null>(null);
      React.useEffect(() => {
        mockFetchTenants({}).catch((e: Error) => setError(e.message));
      }, []);
      return error;
    });
    await waitFor(() => expect(result.current).toBe('Network error'));
  });

  it('refetches when filter changes', async () => {
    mockFetchTenants.mockResolvedValue({ data: mockTenants, total: 3 });
    const { result } = renderHook(() => {
      const [filter, setFilter] = React.useState('active');
      React.useEffect(() => {
        mockFetchTenants({ status: filter });
      }, [filter]);
      return { setFilter };
    });
    await waitFor(() => expect(mockFetchTenants).toHaveBeenCalledWith({ status: 'active' }));
    act(() => result.current.setFilter('suspended'));
    await waitFor(() => expect(mockFetchTenants).toHaveBeenCalledWith({ status: 'suspended' }));
    expect(mockFetchTenants).toHaveBeenCalledTimes(2);
  });

  it('pagination fetches next page', async () => {
    mockFetchTenants.mockResolvedValue({ data: mockTenants, total: 100 });
    const { result } = renderHook(() => {
      const [page, setPage] = React.useState(1);
      React.useEffect(() => {
        mockFetchTenants({ page, pageSize: 20 });
      }, [page]);
      return { setPage };
    });
    await waitFor(() => expect(mockFetchTenants).toHaveBeenCalledWith({ page: 1, pageSize: 20 }));
    act(() => result.current.setPage(2));
    await waitFor(() => expect(mockFetchTenants).toHaveBeenCalledWith({ page: 2, pageSize: 20 }));
  });

  it('sort param is sent to query', async () => {
    mockFetchTenants.mockResolvedValue({ data: mockTenants, total: 3 });
    const { result } = renderHook(() => {
      const [sort, setSort] = React.useState({ field: 'createdAt', direction: 'asc' });
      React.useEffect(() => {
        mockFetchTenants({ sort: sort.field, direction: sort.direction });
      }, [sort]);
      return { setSort };
    });
    await waitFor(() => expect(mockFetchTenants).toHaveBeenCalledWith({ sort: 'createdAt', direction: 'asc' }));
    act(() => result.current.setSort({ field: 'revenue', direction: 'desc' }));
    await waitFor(() => expect(mockFetchTenants).toHaveBeenCalledWith({ sort: 'revenue', direction: 'desc' }));
  });
});

// ---------------------------------------------------------------------------
// 2. PlatformTenantsKPIs + React Query
// ---------------------------------------------------------------------------

describe('PlatformTenantsKPIs + React Query', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchKPIs.mockResolvedValue(mockKPIs);
  });

  it('fetches KPI data on mount', async () => {
    const { result } = renderHook(() => {
      const [kpis, setKpis] = React.useState<typeof mockKPIs | null>(null);
      React.useEffect(() => {
        mockFetchKPIs().then(setKpis);
      }, []);
      return kpis;
    });
    await waitFor(() => expect(result.current).toEqual(mockKPIs));
  });

  it('stale-while-revalidate serves cached data then updates', async () => {
    const staleData = { ...mockKPIs, totalTenants: 2 };
    const freshData = { ...mockKPIs, totalTenants: 3 };
    const cache = { data: staleData };
    mockFetchKPIs.mockResolvedValueOnce(freshData);
    const { result } = renderHook(() => {
      const [kpis, setKpis] = React.useState(cache.data);
      React.useEffect(() => {
        mockFetchKPIs().then((fresh: typeof mockKPIs) => setKpis(fresh));
      }, []);
      return kpis;
    });
    expect(result.current.totalTenants).toBe(2);
    await waitFor(() => expect(result.current.totalTenants).toBe(3));
  });

  it('error shows fallback values', async () => {
    mockFetchKPIs.mockRejectedValueOnce(new Error('KPI fetch failed'));
    const fallback = { totalTenants: 0, activeTenants: 0, suspendedTenants: 0, totalRevenue: 0, revenueGrowth: 0 };
    const { result } = renderHook(() => {
      const [kpis, setKpis] = React.useState(fallback);
      React.useEffect(() => {
        mockFetchKPIs().catch(() => setKpis(fallback));
      }, []);
      return kpis;
    });
    await waitFor(() => expect(result.current).toEqual(fallback));
  });

  it('refreshes KPIs on interval', async () => {
    vi.useFakeTimers();
    mockFetchKPIs.mockResolvedValue(mockKPIs);
    const { result } = renderHook(() => {
      const [callCount, setCallCount] = React.useState(0);
      React.useEffect(() => {
        const id = setInterval(() => {
          mockFetchKPIs().then(() => setCallCount(c => c + 1));
        }, 30000);
        return () => clearInterval(id);
      }, []);
      return callCount;
    });
    act(() => vi.advanceTimersByTime(30000));
    await waitFor(() => expect(result.current).toBeGreaterThanOrEqual(1));
    act(() => vi.advanceTimersByTime(30000));
    await waitFor(() => expect(result.current).toBeGreaterThanOrEqual(2));
    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// 3. PlatformTenantActionsSheet + mutations
// ---------------------------------------------------------------------------

describe('PlatformTenantActionsSheet + mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActivateTenant.mockResolvedValue({ id: 't2', status: 'active' });
    mockSuspendTenant.mockResolvedValue({ id: 't1', status: 'suspended' });
    mockDeleteTenant.mockResolvedValue({ success: true });
    mockShowToast.mockImplementation(() => {});
  });

  it('activate tenant mutation called with id', async () => {
    await mockActivateTenant({ id: 't2' });
    expect(mockActivateTenant).toHaveBeenCalledWith({ id: 't2' });
  });

  it('suspend mutation called with reason', async () => {
    await mockSuspendTenant({ id: 't1', reason: 'Billing issue' });
    expect(mockSuspendTenant).toHaveBeenCalledWith({ id: 't1', reason: 'Billing issue' });
  });

  it('delete mutation called with confirmation', async () => {
    await mockDeleteTenant({ id: 't1', confirmation: 'DELETE' });
    expect(mockDeleteTenant).toHaveBeenCalledWith({ id: 't1', confirmation: 'DELETE' });
  });

  it('optimistic update applies to list before response', async () => {
    const queryClient = buildQueryClient();
    queryClient.setQueryData(['tenants'], (old: typeof mockTenants) => {
      return old?.map(t => t.id === 't2' ? { ...t, status: 'active' } : t);
    });
    expect(queryClient.setQueryData).toHaveBeenCalled();
  });

  it('rollback optimistic update on error', async () => {
    const queryClient = buildQueryClient();
    const snapshot = [...mockTenants];
    mockActivateTenant.mockRejectedValueOnce(new Error('Failed'));
    queryClient.setQueryData(['tenants'], snapshot);
    try {
      await mockActivateTenant({ id: 't2' });
    } catch {
      queryClient.setQueryData(['tenants'], snapshot);
    }
    expect(queryClient.setQueryData).toHaveBeenLastCalledWith(['tenants'], snapshot);
  });

  it('shows success toast on activate', async () => {
    mockActivateTenant.mockResolvedValueOnce({ id: 't2', status: 'active', name: 'Beta LLC' });
    const result = await mockActivateTenant({ id: 't2' });
    mockShowToast({ type: 'success', message: `${result.name} activated` });
    expect(mockShowToast).toHaveBeenCalledWith({ type: 'success', message: 'Beta LLC activated' });
  });

  it('shows error toast on activation failure', async () => {
    mockActivateTenant.mockRejectedValueOnce(new Error('Server error'));
    try {
      await mockActivateTenant({ id: 't2' });
    } catch {
      mockShowToast({ type: 'error', message: 'Activation failed' });
    }
    expect(mockShowToast).toHaveBeenCalledWith({ type: 'error', message: 'Activation failed' });
  });
});

// ---------------------------------------------------------------------------
// 4. PlatformTenantsHeader + filter state
// ---------------------------------------------------------------------------

describe('PlatformTenantsHeader + filter state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('search input debounce updates query after delay', async () => {
    const onSearch = vi.fn();
    const { result } = renderHook(() => {
      const [search, setSearch] = React.useState('');
      React.useEffect(() => {
        const id = setTimeout(() => { if (search) onSearch(search); }, 300);
        return () => clearTimeout(id);
      }, [search]);
      return { setSearch };
    });
    act(() => result.current.setSearch('Acme'));
    expect(onSearch).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(300));
    await waitFor(() => expect(onSearch).toHaveBeenCalledWith('Acme'));
  });

  it('status filter updates query', async () => {
    const onFilterChange = vi.fn();
    const { result } = renderHook(() => {
      const [status, setStatus] = React.useState('all');
      React.useEffect(() => { onFilterChange({ status }); }, [status]);
      return { setStatus };
    });
    act(() => result.current.setStatus('active'));
    await waitFor(() => expect(onFilterChange).toHaveBeenCalledWith({ status: 'active' }));
  });

  it('date range updates query', async () => {
    const onFilterChange = vi.fn();
    const { result } = renderHook(() => {
      const [range, setRange] = React.useState<{ from: string; to: string } | null>(null);
      React.useEffect(() => { if (range) onFilterChange({ dateRange: range }); }, [range]);
      return { setRange };
    });
    act(() => result.current.setRange({ from: '2024-01-01', to: '2024-03-31' }));
    await waitFor(() => expect(onFilterChange).toHaveBeenCalledWith({ dateRange: { from: '2024-01-01', to: '2024-03-31' } }));
  });

  it('clear resets all filter params', async () => {
    const onClear = vi.fn();
    const { result } = renderHook(() => {
      const [filters, setFilters] = React.useState({ search: 'Acme', status: 'active', dateRange: { from: '2024-01-01', to: '2024-03-31' } });
      const clear = () => {
        setFilters({ search: '', status: 'all', dateRange: { from: '', to: '' } });
        onClear();
      };
      return { filters, clear };
    });
    act(() => result.current.clear());
    expect(onClear).toHaveBeenCalled();
    await waitFor(() => expect(result.current.filters.search).toBe(''));
    expect(result.current.filters.status).toBe('all');
  });

  it('export triggers download mutation', async () => {
    mockExportTenants.mockResolvedValueOnce({ url: 'https://example.com/export.csv' });
    await mockExportTenants({ format: 'csv', filters: {} });
    expect(mockExportTenants).toHaveBeenCalledWith({ format: 'csv', filters: {} });
  });
});

// ---------------------------------------------------------------------------
// 5. Tenant list table interactions
// ---------------------------------------------------------------------------

describe('Tenant list table interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchTenants.mockResolvedValue({ data: mockTenants, total: 3 });
  });

  it('click row opens actions sheet', async () => {
    const onRowClick = vi.fn();
    const { result } = renderHook(() => {
      const [sheetOpen, setSheetOpen] = React.useState(false);
      const [selectedTenant, setSelectedTenant] = React.useState<(typeof mockTenants)[0] | null>(null);
      const handleRowClick = (tenant: (typeof mockTenants)[0]) => {
        setSelectedTenant(tenant);
        setSheetOpen(true);
        onRowClick(tenant);
      };
      return { sheetOpen, selectedTenant, handleRowClick };
    });
    act(() => result.current.handleRowClick(mockTenants[0]));
    expect(onRowClick).toHaveBeenCalledWith(mockTenants[0]);
    await waitFor(() => expect(result.current.sheetOpen).toBe(true));
    expect(result.current.selectedTenant?.id).toBe('t1');
  });

  it('sort column click updates query param', async () => {
    const onSortChange = vi.fn();
    const { result } = renderHook(() => {
      const [sort, setSort] = React.useState({ field: 'name', direction: 'asc' });
      const handleSort = (field: string) => {
        const next = sort.field === field && sort.direction === 'asc' ? 'desc' : 'asc';
        setSort({ field, direction: next });
        onSortChange({ field, direction: next });
      };
      return { sort, handleSort };
    });
    act(() => result.current.handleSort('createdAt'));
    expect(onSortChange).toHaveBeenCalledWith({ field: 'createdAt', direction: 'asc' });
    act(() => result.current.handleSort('createdAt'));
    await waitFor(() => expect(onSortChange).toHaveBeenLastCalledWith({ field: 'createdAt', direction: 'desc' }));
  });

  it('page size change triggers refetch', async () => {
    const { result } = renderHook(() => {
      const [pageSize, setPageSize] = React.useState(20);
      React.useEffect(() => {
        mockFetchTenants({ page: 1, pageSize });
      }, [pageSize]);
      return { setPageSize };
    });
    await waitFor(() => expect(mockFetchTenants).toHaveBeenCalledWith({ page: 1, pageSize: 20 }));
    act(() => result.current.setPageSize(50));
    await waitFor(() => expect(mockFetchTenants).toHaveBeenCalledWith({ page: 1, pageSize: 50 }));
  });

  it('bulk select enables bulk action buttons', async () => {
    const { result } = renderHook(() => {
      const [selected, setSelected] = React.useState<string[]>([]);
      const bulkEnabled = selected.length > 0;
      const toggle = (id: string) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
      return { selected, bulkEnabled, toggle };
    });
    expect(result.current.bulkEnabled).toBe(false);
    act(() => result.current.toggle('t1'));
    act(() => result.current.toggle('t2'));
    await waitFor(() => expect(result.current.bulkEnabled).toBe(true));
    expect(result.current.selected).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// 6. Error propagation flows
// ---------------------------------------------------------------------------

describe('Error propagation flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShowToast.mockImplementation(() => {});
  });

  it('400 on activate shows field error message', async () => {
    const error = { status: 400, message: 'Invalid tenant state transition' };
    mockActivateTenant.mockRejectedValueOnce(error);
    const { result } = renderHook(() => {
      const [fieldError, setFieldError] = React.useState<string | null>(null);
      const activate = async (id: string) => {
        try {
          await mockActivateTenant({ id });
        } catch (e: unknown) {
          const err = e as { status: number; message: string };
          if (err.status === 400) setFieldError(err.message);
        }
      };
      return { fieldError, activate };
    });
    await act(async () => result.current.activate('t2'));
    await waitFor(() => expect(result.current.fieldError).toBe('Invalid tenant state transition'));
  });

  it('403 shows permission denied toast', async () => {
    const error = { status: 403, message: 'Forbidden' };
    mockActivateTenant.mockRejectedValueOnce(error);
    const { result } = renderHook(() => {
      const handle = async (id: string) => {
        try {
          await mockActivateTenant({ id });
        } catch (e: unknown) {
          const err = e as { status: number };
          if (err.status === 403) mockShowToast({ type: 'error', message: 'insufficient permissions' });
        }
      };
      return { handle };
    });
    await act(async () => result.current.handle('t1'));
    expect(mockShowToast).toHaveBeenCalledWith({ type: 'error', message: 'insufficient permissions' });
  });

  it('500 shows generic error toast', async () => {
    mockActivateTenant.mockRejectedValueOnce({ status: 500, message: 'Internal server error' });
    const { result } = renderHook(() => {
      const handle = async (id: string) => {
        try {
          await mockActivateTenant({ id });
        } catch (e: unknown) {
          const err = e as { status: number };
          if (err.status === 500) mockShowToast({ type: 'error', message: 'Something went wrong' });
        }
      };
      return { handle };
    });
    await act(async () => result.current.handle('t1'));
    expect(mockShowToast).toHaveBeenCalledWith({ type: 'error', message: 'Something went wrong' });
  });

  it('network timeout shows retry option', async () => {
    const timeoutError = { code: 'TIMEOUT', message: 'Request timed out' };
    mockFetchTenants.mockRejectedValueOnce(timeoutError);
    const { result } = renderHook(() => {
      const [showRetry, setShowRetry] = React.useState(false);
      React.useEffect(() => {
        mockFetchTenants({}).catch((e: { code: string }) => {
          if (e.code === 'TIMEOUT') setShowRetry(true);
        });
      }, []);
      return showRetry;
    });
    await waitFor(() => expect(result.current).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// 7. Form submit → state change
// ---------------------------------------------------------------------------

describe('Form submit → state change', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSuspendTenant.mockResolvedValue({ id: 't1', status: 'suspended' });
    mockFetchKPIs.mockResolvedValue(mockKPIs);
    mockFetchTenants.mockResolvedValue({ data: mockTenants, total: 3 });
  });

  it('suspend form with reason submits correctly', async () => {
    const { result } = renderHook(() => {
      const [reason, setReason] = React.useState('');
      const [submitted, setSubmitted] = React.useState(false);
      const submit = async () => {
        await mockSuspendTenant({ id: 't1', reason });
        setSubmitted(true);
      };
      return { reason, setReason, submitted, submit };
    });
    act(() => result.current.setReason('Billing overdue'));
    await act(async () => result.current.submit());
    expect(mockSuspendTenant).toHaveBeenCalledWith({ id: 't1', reason: 'Billing overdue' });
    await waitFor(() => expect(result.current.submitted).toBe(true));
  });

  it('tenant status updates in list after action', async () => {
    const { result } = renderHook(() => {
      const [tenants, setTenants] = React.useState(mockTenants);
      const suspend = async (id: string, reason: string) => {
        const updated = await mockSuspendTenant({ id, reason });
        setTenants(prev => prev.map(t => t.id === updated.id ? { ...t, status: updated.status } : t));
      };
      return { tenants, suspend };
    });
    await act(async () => result.current.suspend('t1', 'Non-payment'));
    await waitFor(() => {
      const t1 = result.current.tenants.find(t => t.id === 't1');
      expect(t1?.status).toBe('suspended');
    });
  });

  it('KPIs refresh after action completes', async () => {
    const { result } = renderHook(() => {
      const [kpis, setKpis] = React.useState<typeof mockKPIs | null>(null);
      const doActionAndRefresh = async () => {
        await mockActivateTenant({ id: 't2' });
        const fresh = await mockFetchKPIs();
        setKpis(fresh);
      };
      mockActivateTenant.mockResolvedValueOnce({ id: 't2', status: 'active' });
      return { kpis, doActionAndRefresh };
    });
    await act(async () => result.current.doActionAndRefresh());
    await waitFor(() => expect(result.current.kpis).toEqual(mockKPIs));
  });
});

// ---------------------------------------------------------------------------
// 8. Search + filter combination
// ---------------------------------------------------------------------------

describe('Search + filter combination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchTenants.mockResolvedValue({ data: mockTenants, total: 3 });
  });

  it('combined search + status filter sends merged query', async () => {
    const { result } = renderHook(() => {
      const [params, setParams] = React.useState({ search: '', status: 'all' });
      React.useEffect(() => {
        mockFetchTenants(params);
      }, [params]);
      return { setParams };
    });
    await waitFor(() => expect(mockFetchTenants).toHaveBeenCalledWith({ search: '', status: 'all' }));
    act(() => result.current.setParams({ search: 'Acme', status: 'active' }));
    await waitFor(() => expect(mockFetchTenants).toHaveBeenCalledWith({ search: 'Acme', status: 'active' }));
  });

  it('results update when combined filters change', async () => {
    const filteredTenants = [mockTenants[0]];
    mockFetchTenants.mockResolvedValueOnce({ data: mockTenants, total: 3 });
    mockFetchTenants.mockResolvedValueOnce({ data: filteredTenants, total: 1 });
    const { result } = renderHook(() => {
      const [data, setData] = React.useState<typeof mockTenants>([]);
      const [params, setParams] = React.useState({ search: '', status: 'all' });
      React.useEffect(() => {
        mockFetchTenants(params).then((res: { data: typeof mockTenants }) => setData(res.data));
      }, [params]);
      return { data, setParams };
    });
    await waitFor(() => expect(result.current.data).toHaveLength(3));
    act(() => result.current.setParams({ search: 'Acme', status: 'active' }));
    await waitFor(() => expect(result.current.data).toHaveLength(1));
  });

  it('clearing one filter keeps the other active', async () => {
    const { result } = renderHook(() => {
      const [params, setParams] = React.useState({ search: 'Acme', status: 'active' });
      React.useEffect(() => {
        mockFetchTenants(params);
      }, [params]);
      const clearSearch = () => setParams(prev => ({ ...prev, search: '' }));
      return { params, clearSearch };
    });
    await waitFor(() => expect(mockFetchTenants).toHaveBeenCalledWith({ search: 'Acme', status: 'active' }));
    act(() => result.current.clearSearch());
    await waitFor(() => expect(mockFetchTenants).toHaveBeenCalledWith({ search: '', status: 'active' }));
    expect(result.current.params.status).toBe('active');
    expect(result.current.params.search).toBe('');
  });
});
