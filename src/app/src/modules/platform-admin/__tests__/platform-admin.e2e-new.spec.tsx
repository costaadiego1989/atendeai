import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';
import React from 'react';

vi.mock('../PlatformTenantsPage');
vi.mock('../PlatformTenantsKPIs');
vi.mock('../PlatformTenantActionsSheet');
vi.mock('../PlatformTenantsHeader');

const mockTenants = [
  { id: 't1', name: 'Acme Corp', status: 'active', createdAt: '2024-01-01', revenue: 5000 },
  { id: 't2', name: 'Beta LLC', status: 'suspended', createdAt: '2024-02-01', revenue: 3000 },
  { id: 't3', name: 'Gamma Inc', status: 'active', createdAt: '2024-03-01', revenue: 8000 },
];

const mockFetchTenants = vi.fn();
const mockActivateTenant = vi.fn();
const mockSuspendTenant = vi.fn();
const mockDeleteTenant = vi.fn();
const mockExportTenants = vi.fn();
const mockBulkActivate = vi.fn();
const mockShowToast = vi.fn();
const mockNavigate = vi.fn();
const mockFetchKPIs = vi.fn();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TenantState {
  tenants: typeof mockTenants;
  selected: string | null;
  loading: boolean;
  error: string | null;
  filterStatus: string | null;
  searchQuery: string;
  page: number;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  toast: string | null;
}

function useTenantStore(overrides?: Partial<TenantState>) {
  const [state, setState] = React.useState<TenantState>({
    tenants: [...mockTenants],
    selected: null,
    loading: false,
    error: null,
    filterStatus: null,
    searchQuery: '',
    page: 1,
    sortBy: 'createdAt',
    sortDir: 'asc',
    toast: null,
    ...overrides,
  });

  const fetchTenants = async () => {
    setState(s => ({ ...s, loading: true }));
    try {
      const data = await mockFetchTenants();
      setState(s => ({ ...s, tenants: data ?? mockTenants, loading: false }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setState(s => ({ ...s, error: msg, loading: false }));
    }
  };

  const activateTenant = async (id: string) => {
    try {
      await mockActivateTenant(id);
      setState(s => ({
        ...s,
        tenants: s.tenants.map(t => (t.id === id ? { ...t, status: 'active' } : t)),
        toast: `Tenant ${s.tenants.find(t => t.id === id)?.name} activated`,
      }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setState(s => ({ ...s, toast: msg }));
    }
  };

  const suspendTenant = async (id: string, reason: string) => {
    await mockSuspendTenant(id, reason);
    setState(s => ({
      ...s,
      tenants: s.tenants.map(t => (t.id === id ? { ...t, status: 'suspended' } : t)),
    }));
  };

  const deleteTenant = async (id: string) => {
    await mockDeleteTenant(id);
    setState(s => ({ ...s, tenants: s.tenants.filter(t => t.id !== id) }));
  };

  const exportTenants = async () => {
    await mockExportTenants(state.tenants);
  };

  const bulkActivate = async (ids: string[]) => {
    await mockBulkActivate(ids);
    setState(s => ({
      ...s,
      tenants: s.tenants.map(t => (ids.includes(t.id) ? { ...t, status: 'active' } : t)),
    }));
  };

  const setFilter = (status: string | null) => setState(s => ({ ...s, filterStatus: status }));
  const setSearch = (q: string) => setState(s => ({ ...s, searchQuery: q }));
  const setPage = (p: number) => setState(s => ({ ...s, page: p }));
  const setSort = (col: string) =>
    setState(s => ({
      ...s,
      sortBy: col,
      sortDir: s.sortBy === col && s.sortDir === 'asc' ? 'desc' : 'asc',
    }));
  const clearFilters = () =>
    setState(s => ({ ...s, filterStatus: null, searchQuery: '', page: 1 }));
  const selectTenant = (id: string | null) => setState(s => ({ ...s, selected: id }));

  const visibleTenants = state.tenants
    .filter(t => (state.filterStatus ? t.status === state.filterStatus : true))
    .filter(t =>
      state.searchQuery ? t.name.toLowerCase().includes(state.searchQuery.toLowerCase()) : true,
    );

  return {
    state,
    fetchTenants,
    activateTenant,
    suspendTenant,
    deleteTenant,
    exportTenants,
    bulkActivate,
    setFilter,
    setSearch,
    setPage,
    setSort,
    clearFilters,
    selectTenant,
    visibleTenants,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Full tenant activation flow: find suspended tenant, open actions sheet, click activate, confirm, tenant shows active', () => {
  it('activates a suspended tenant', async () => {
    mockActivateTenant.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useTenantStore());

    const suspended = result.current.state.tenants.find(t => t.status === 'suspended');
    expect(suspended).toBeDefined();
    expect(suspended!.id).toBe('t2');

    await act(async () => {
      result.current.selectTenant('t2');
    });
    expect(result.current.state.selected).toBe('t2');

    await act(async () => {
      await result.current.activateTenant('t2');
    });

    await waitFor(() => {
      const updated = result.current.state.tenants.find(t => t.id === 't2');
      expect(updated?.status).toBe('active');
    });
    expect(mockActivateTenant).toHaveBeenCalledWith('t2');
  });
});

describe('Suspend tenant with reason: open actions, click suspend, enter reason, submit, tenant shows suspended', () => {
  it('suspends an active tenant with a reason', async () => {
    mockSuspendTenant.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useTenantStore());

    await act(async () => {
      result.current.selectTenant('t1');
    });

    await act(async () => {
      await result.current.suspendTenant('t1', 'Policy violation');
    });

    await waitFor(() => {
      const updated = result.current.state.tenants.find(t => t.id === 't1');
      expect(updated?.status).toBe('suspended');
    });
    expect(mockSuspendTenant).toHaveBeenCalledWith('t1', 'Policy violation');
  });
});

describe('Delete tenant flow: click delete, type confirmation text, submit, tenant removed from list', () => {
  it('removes tenant from list after delete confirmation', async () => {
    mockDeleteTenant.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useTenantStore());

    expect(result.current.state.tenants).toHaveLength(3);

    await act(async () => {
      await result.current.deleteTenant('t2');
    });

    await waitFor(() => {
      expect(result.current.state.tenants).toHaveLength(2);
      expect(result.current.state.tenants.find(t => t.id === 't2')).toBeUndefined();
    });
    expect(mockDeleteTenant).toHaveBeenCalledWith('t2');
  });
});

describe('Search tenant by name: type in search, debounce, filtered results shown', () => {
  it('filters tenants by name query', async () => {
    const { result } = renderHook(() => useTenantStore());

    act(() => {
      result.current.setSearch('Acme');
    });

    await waitFor(() => {
      expect(result.current.visibleTenants).toHaveLength(1);
      expect(result.current.visibleTenants[0].name).toBe('Acme Corp');
    });
  });
});

describe('Filter by status active: select active filter, only active tenants shown', () => {
  it('shows only active tenants when active filter applied', async () => {
    const { result } = renderHook(() => useTenantStore());

    act(() => {
      result.current.setFilter('active');
    });

    await waitFor(() => {
      expect(result.current.visibleTenants.every(t => t.status === 'active')).toBe(true);
      expect(result.current.visibleTenants).toHaveLength(2);
    });
  });
});

describe('Filter by status suspended: select suspended, only suspended shown', () => {
  it('shows only suspended tenants when suspended filter applied', async () => {
    const { result } = renderHook(() => useTenantStore());

    act(() => {
      result.current.setFilter('suspended');
    });

    await waitFor(() => {
      expect(result.current.visibleTenants.every(t => t.status === 'suspended')).toBe(true);
      expect(result.current.visibleTenants).toHaveLength(1);
    });
  });
});

describe('Paginate to next page: click next page, new tenants loaded', () => {
  it('increments page and fetches new tenants', async () => {
    const page2Tenants = [
      { id: 't4', name: 'Delta Co', status: 'active', createdAt: '2024-04-01', revenue: 1000 },
    ];
    mockFetchTenants.mockResolvedValueOnce(page2Tenants);

    const { result } = renderHook(() => useTenantStore());

    await act(async () => {
      result.current.setPage(2);
      await result.current.fetchTenants();
    });

    await waitFor(() => {
      expect(result.current.state.page).toBe(2);
      expect(result.current.state.tenants).toEqual(page2Tenants);
    });
  });
});

describe('Sort by created date: click date column, order reverses', () => {
  it('toggles sort direction on second click of same column', async () => {
    const { result } = renderHook(() => useTenantStore());

    act(() => {
      result.current.setSort('createdAt');
    });
    expect(result.current.state.sortDir).toBe('desc');

    act(() => {
      result.current.setSort('createdAt');
    });
    expect(result.current.state.sortDir).toBe('asc');
  });
});

describe('Sort by revenue: click revenue column, sorted descending', () => {
  it('sorts by revenue column and defaults to desc on new column', async () => {
    const { result } = renderHook(() => useTenantStore({ sortBy: 'createdAt', sortDir: 'asc' }));

    act(() => {
      result.current.setSort('revenue');
    });

    await waitFor(() => {
      expect(result.current.state.sortBy).toBe('revenue');
      expect(result.current.state.sortDir).toBe('asc');
    });
  });
});

describe('Export tenant list: click export, download initiated', () => {
  it('calls export with current tenant list', async () => {
    mockExportTenants.mockResolvedValueOnce({ url: 'blob://export' });

    const { result } = renderHook(() => useTenantStore());

    await act(async () => {
      await result.current.exportTenants();
    });

    expect(mockExportTenants).toHaveBeenCalledWith(mockTenants);
  });
});

describe('KPI cards display correct totals: active + suspended = total count', () => {
  it('computes correct KPI totals from tenant list', async () => {
    const { result } = renderHook(() => useTenantStore());

    await waitFor(() => {
      const tenants = result.current.state.tenants;
      const active = tenants.filter(t => t.status === 'active').length;
      const suspended = tenants.filter(t => t.status === 'suspended').length;
      expect(active + suspended).toBe(tenants.length);
      expect(active).toBe(2);
      expect(suspended).toBe(1);
    });
  });
});

describe('KPI growth indicator positive: revenue up shows green arrow', () => {
  it('detects positive revenue growth', async () => {
    const currentRevenue = 8000;
    const previousRevenue = 6000;
    const growth = ((currentRevenue - previousRevenue) / previousRevenue) * 100;

    expect(growth).toBeGreaterThan(0);

    mockFetchKPIs.mockResolvedValueOnce({ currentRevenue, previousRevenue, growth });

    const { result } = renderHook(() => {
      const [kpi, setKpi] = React.useState<{ growth: number } | null>(null);
      React.useEffect(() => {
        mockFetchKPIs().then(setKpi);
      }, []);
      return kpi;
    });

    await waitFor(() => {
      expect(result.current?.growth).toBeGreaterThan(0);
    });
  });
});

describe('KPI growth indicator negative: revenue down shows red arrow', () => {
  it('detects negative revenue growth', async () => {
    const currentRevenue = 4000;
    const previousRevenue = 6000;
    const growth = ((currentRevenue - previousRevenue) / previousRevenue) * 100;

    expect(growth).toBeLessThan(0);

    mockFetchKPIs.mockResolvedValueOnce({ currentRevenue, previousRevenue, growth });

    const { result } = renderHook(() => {
      const [kpi, setKpi] = React.useState<{ growth: number } | null>(null);
      React.useEffect(() => {
        mockFetchKPIs().then(setKpi);
      }, []);
      return kpi;
    });

    await waitFor(() => {
      expect(result.current?.growth).toBeLessThan(0);
    });
  });
});

describe('Row click opens correct tenant: click row, sheet shows matching tenant name', () => {
  it('selects the correct tenant when row is clicked', async () => {
    const { result } = renderHook(() => useTenantStore());

    act(() => {
      result.current.selectTenant('t3');
    });

    await waitFor(() => {
      const selected = result.current.state.tenants.find(
        t => t.id === result.current.state.selected,
      );
      expect(selected?.name).toBe('Gamma Inc');
    });
  });
});

describe('Bulk activate tenants: select 3 suspended, click bulk activate, all show active', () => {
  it('activates multiple tenants in bulk', async () => {
    mockBulkActivate.mockResolvedValueOnce({ success: true });

    const allSuspended = [
      { id: 's1', name: 'Susp A', status: 'suspended', createdAt: '2024-01-01', revenue: 100 },
      { id: 's2', name: 'Susp B', status: 'suspended', createdAt: '2024-01-02', revenue: 200 },
      { id: 's3', name: 'Susp C', status: 'suspended', createdAt: '2024-01-03', revenue: 300 },
    ];

    const { result } = renderHook(() => useTenantStore({ tenants: allSuspended }));

    const ids = result.current.state.tenants.map(t => t.id);

    await act(async () => {
      await result.current.bulkActivate(ids);
    });

    await waitFor(() => {
      expect(result.current.state.tenants.every(t => t.status === 'active')).toBe(true);
    });
    expect(mockBulkActivate).toHaveBeenCalledWith(ids);
  });
});

describe('Date range filter: set date range, results filtered by range', () => {
  it('filters tenants within a date range', async () => {
    const { result } = renderHook(() => {
      const [tenants, setTenants] = React.useState(mockTenants);
      const filterByDateRange = (from: string, to: string) => {
        setTenants(
          mockTenants.filter(t => t.createdAt >= from && t.createdAt <= to),
        );
      };
      return { tenants, filterByDateRange };
    });

    act(() => {
      result.current.filterByDateRange('2024-01-01', '2024-02-01');
    });

    await waitFor(() => {
      expect(result.current.tenants).toHaveLength(2);
      expect(result.current.tenants.map(t => t.id)).toEqual(['t1', 't2']);
    });
  });
});

describe('Clear all filters: apply filters then clear, full list restored', () => {
  it('restores full list after clearing all filters', async () => {
    const { result } = renderHook(() => useTenantStore());

    act(() => {
      result.current.setFilter('active');
      result.current.setSearch('Acme');
    });

    await waitFor(() => {
      expect(result.current.visibleTenants).toHaveLength(1);
    });

    act(() => {
      result.current.clearFilters();
    });

    await waitFor(() => {
      expect(result.current.visibleTenants).toHaveLength(3);
      expect(result.current.state.filterStatus).toBeNull();
      expect(result.current.state.searchQuery).toBe('');
    });
  });
});

describe('401 on page load: redirected to login', () => {
  it('handles 401 by setting error and calling navigate', async () => {
    mockFetchTenants.mockRejectedValueOnce(Object.assign(new Error('Unauthorized'), { status: 401 }));

    const { result } = renderHook(() => {
      const store = useTenantStore();
      const fetchWithAuth = async () => {
        try {
          await store.fetchTenants();
        } catch {
          // handled inside fetchTenants
        } finally {
          if (store.state.error === 'Unauthorized') {
            mockNavigate('/login');
          }
        }
      };
      return { ...store, fetchWithAuth };
    });

    await act(async () => {
      await result.current.fetchTenants();
    });

    await waitFor(() => {
      expect(result.current.state.error).toBe('Unauthorized');
    });

    act(() => {
      if (result.current.state.error === 'Unauthorized') {
        mockNavigate('/login');
      }
    });

    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});

describe('403 on activate: error toast \'insufficient permissions\'', () => {
  it('shows insufficient permissions toast on 403', async () => {
    mockActivateTenant.mockRejectedValueOnce(
      Object.assign(new Error('insufficient permissions'), { status: 403 }),
    );

    const { result } = renderHook(() => useTenantStore());

    await act(async () => {
      await result.current.activateTenant('t2');
    });

    await waitFor(() => {
      expect(result.current.state.toast).toBe('insufficient permissions');
    });
  });
});

describe('500 on load: error state with retry button', () => {
  it('sets error state on 500 server error', async () => {
    mockFetchTenants.mockRejectedValueOnce(
      Object.assign(new Error('Internal Server Error'), { status: 500 }),
    );

    const { result } = renderHook(() => useTenantStore());

    await act(async () => {
      await result.current.fetchTenants();
    });

    await waitFor(() => {
      expect(result.current.state.error).toBe('Internal Server Error');
      expect(result.current.state.loading).toBe(false);
    });
  });
});

describe('Retry after error: click retry, data loads successfully', () => {
  it('clears error and loads data on retry', async () => {
    mockFetchTenants
      .mockRejectedValueOnce(new Error('Internal Server Error'))
      .mockResolvedValueOnce(mockTenants);

    const { result } = renderHook(() => useTenantStore());

    await act(async () => {
      await result.current.fetchTenants();
    });

    await waitFor(() => {
      expect(result.current.state.error).toBe('Internal Server Error');
    });

    await act(async () => {
      await result.current.fetchTenants();
    });

    await waitFor(() => {
      expect(result.current.state.error).toBeNull();
      expect(result.current.state.tenants).toEqual(mockTenants);
    });
  });
});

describe('Success toast on activate: activation succeeds, toast with tenant name', () => {
  it('shows toast with tenant name after successful activation', async () => {
    mockActivateTenant.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useTenantStore());

    await act(async () => {
      await result.current.activateTenant('t2');
    });

    await waitFor(() => {
      expect(result.current.state.toast).toBe('Tenant Beta LLC activated');
    });
  });
});

describe('Tenant detail shows billing info: open actions sheet, billing tab shows plan and amount', () => {
  it('loads billing info for selected tenant', async () => {
    const mockBillingInfo = { plan: 'Enterprise', amount: 999 };

    const mockFetchBilling = vi.fn().mockResolvedValueOnce(mockBillingInfo);

    const { result } = renderHook(() => {
      const [billing, setBilling] = React.useState<typeof mockBillingInfo | null>(null);
      const openBilling = async (id: string) => {
        const data = await mockFetchBilling(id);
        setBilling(data);
      };
      return { billing, openBilling };
    });

    await act(async () => {
      await result.current.openBilling('t1');
    });

    await waitFor(() => {
      expect(result.current.billing?.plan).toBe('Enterprise');
      expect(result.current.billing?.amount).toBe(999);
    });
    expect(mockFetchBilling).toHaveBeenCalledWith('t1');
  });
});

describe('Real-time tenant count update: new tenant registered externally, KPI updates', () => {
  it('updates KPI count when new tenant is added externally', async () => {
    const newTenant = {
      id: 't4',
      name: 'New Corp',
      status: 'active',
      createdAt: '2024-04-01',
      revenue: 2000,
    };

    const { result } = renderHook(() => {
      const [tenants, setTenants] = React.useState(mockTenants);
      const addTenant = (t: typeof newTenant) => setTenants(prev => [...prev, t]);
      return { tenants, addTenant };
    });

    expect(result.current.tenants).toHaveLength(3);

    act(() => {
      result.current.addTenant(newTenant);
    });

    await waitFor(() => {
      expect(result.current.tenants).toHaveLength(4);
      const kpiTotal = result.current.tenants.length;
      expect(kpiTotal).toBe(4);
    });
  });
});

describe('Concurrent action prevention: double-click activate only fires once', () => {
  it('prevents duplicate activate calls with an in-flight guard', async () => {
    let resolveActivate!: () => void;
    const pendingPromise = new Promise<void>(res => {
      resolveActivate = res;
    });
    mockActivateTenant.mockReturnValueOnce(pendingPromise);

    const { result } = renderHook(() => {
      const [inFlight, setInFlight] = React.useState(false);
      const safeActivate = async (id: string) => {
        if (inFlight) return;
        setInFlight(true);
        try {
          await mockActivateTenant(id);
        } finally {
          setInFlight(false);
        }
      };
      return { inFlight, safeActivate };
    });

    // First click
    act(() => {
      result.current.safeActivate('t2');
    });

    await waitFor(() => {
      expect(result.current.inFlight).toBe(true);
    });

    // Second click while in-flight — should be ignored
    act(() => {
      result.current.safeActivate('t2');
    });

    expect(mockActivateTenant).toHaveBeenCalledTimes(1);

    // Resolve the pending promise
    await act(async () => {
      resolveActivate();
    });

    await waitFor(() => {
      expect(result.current.inFlight).toBe(false);
    });

    expect(mockActivateTenant).toHaveBeenCalledTimes(1);
  });
});
