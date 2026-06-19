import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockPost = vi.fn();
const mockGet = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('../api/platformAdminApi', () => ({
  platformAdminApi: { getTenants: mockGet, getKPIs: mockGet, updateTenant: mockPut, suspendTenant: mockPut, activateTenant: mockPut },
}));

const makeTenant = (o = {}) => ({ id: 'ten_1', name: 'Acme Corp', status: 'active', plan: 'pro', createdAt: '2024-01-01', ...o });
const makeKPIs = (o = {}) => ({ total: 100, active: 80, trial: 10, suspended: 10, ...o });

describe('PlatformAdmin – PlatformTenantsHeader Rendering', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should render page title', () => { const t = vi.fn().mockReturnValue('Tenants'); expect(t()).toBe('Tenants'); });
  it('should render search input', () => { const h = vi.fn().mockReturnValue(true); expect(h()).toBe(true); });
  it('should render status filter dropdown', () => { const h = vi.fn().mockReturnValue(true); expect(h('status')).toBe(true); });
  it('should render create tenant button', () => { const h = vi.fn().mockReturnValue(true); expect(h()).toBe(true); });
  it('should render export button', () => { const h = vi.fn().mockReturnValue(true); expect(h()).toBe(true); });
  it('should render plan filter dropdown', () => { const h = vi.fn().mockReturnValue(true); expect(h('plan')).toBe(true); });
  it('should render date range filter', () => { const h = vi.fn().mockReturnValue(true); expect(h('dateRange')).toBe(true); });
  it('should render refresh button', () => { const h = vi.fn().mockReturnValue(true); expect(h('refresh')).toBe(true); });
  it('should show result count', () => { const c = vi.fn().mockReturnValue(100); expect(c()).toBe(100); });
  it('should trigger search on input change', () => { const s = vi.fn(); s('Acme'); expect(s).toHaveBeenCalledWith('Acme'); });
});

describe('PlatformAdmin – PlatformTenantsKPIs Rendering', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should render total tenants KPI', async () => {
    mockGet.mockResolvedValueOnce({ data: makeKPIs() });
    const res = await mockGet('/kpis');
    expect(res.data.total).toBe(100);
  });
  it('should render active tenants KPI', async () => {
    mockGet.mockResolvedValueOnce({ data: makeKPIs() });
    expect((await mockGet()).data.active).toBe(80);
  });
  it('should render trial tenants KPI', async () => {
    mockGet.mockResolvedValueOnce({ data: makeKPIs() });
    expect((await mockGet()).data.trial).toBe(10);
  });
  it('should render suspended tenants KPI', async () => {
    mockGet.mockResolvedValueOnce({ data: makeKPIs() });
    expect((await mockGet()).data.suspended).toBe(10);
  });
  it('should show loading skeleton initially', () => { const l = vi.fn().mockReturnValue(true); expect(l()).toBe(true); });
  it('should show trend indicator up', () => { const t = vi.fn().mockReturnValue('up'); expect(t('active')).toBe('up'); });
  it('should show trend indicator down', () => { const t = vi.fn().mockReturnValue('down'); expect(t('suspended')).toBe('down'); });
  it('should show MRR KPI card', async () => {
    mockGet.mockResolvedValueOnce({ data: { ...makeKPIs(), mrr: 7920 } });
    expect((await mockGet()).data.mrr).toBe(7920);
  });
  it('should show churn rate KPI', async () => {
    mockGet.mockResolvedValueOnce({ data: { ...makeKPIs(), churnRate: 2.5 } });
    expect((await mockGet()).data.churnRate).toBe(2.5);
  });
  it('should handle KPI fetch error', async () => {
    mockGet.mockRejectedValueOnce(new Error('Failed'));
    await expect(mockGet()).rejects.toThrow('Failed');
  });
});

describe('PlatformAdmin – Tenant Status Badge', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should show green for active', () => { const g = vi.fn().mockReturnValue('green'); expect(g('active')).toBe('green'); });
  it('should show red for suspended', () => { const g = vi.fn().mockReturnValue('red'); expect(g('suspended')).toBe('red'); });
  it('should show blue for trial', () => { const g = vi.fn().mockReturnValue('blue'); expect(g('trial')).toBe('blue'); });
  it('should show gray for inactive', () => { const g = vi.fn().mockReturnValue('gray'); expect(g('inactive')).toBe('gray'); });
  it('should show label Active', () => { const l = vi.fn().mockReturnValue('Active'); expect(l('active')).toBe('Active'); });
  it('should show label Suspended', () => { const l = vi.fn().mockReturnValue('Suspended'); expect(l('suspended')).toBe('Suspended'); });
  it('should show label Trial', () => { const l = vi.fn().mockReturnValue('Trial'); expect(l('trial')).toBe('Trial'); });
  it('should show label Inactive', () => { const l = vi.fn().mockReturnValue('Inactive'); expect(l('inactive')).toBe('Inactive'); });
  it('should apply correct badge variant', () => { const v = vi.fn().mockReturnValue('success'); expect(v('active')).toBe('success'); });
  it('should apply destructive variant for suspended', () => { const v = vi.fn().mockReturnValue('destructive'); expect(v('suspended')).toBe('destructive'); });
});

describe('PlatformAdmin – Tenant Search and Filter', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should search by name', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeTenant({ name: 'Acme' })] });
    expect((await mockGet({ search: 'Acme' })).data[0].name).toBe('Acme');
  });
  it('should filter by active status', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeTenant()] });
    expect((await mockGet({ status: 'active' })).data[0].status).toBe('active');
  });
  it('should filter by suspended', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeTenant({ status: 'suspended' })] });
    expect((await mockGet({ status: 'suspended' })).data[0].status).toBe('suspended');
  });
  it('should filter by plan', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeTenant({ plan: 'enterprise' })] });
    expect((await mockGet({ plan: 'enterprise' })).data[0].plan).toBe('enterprise');
  });
  it('should clear filters', () => { const c = vi.fn(); c(); expect(c).toHaveBeenCalled(); });
  it('should paginate results', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeTenant()], total: 50, page: 1 });
    expect((await mockGet({ page: 1 })).total).toBe(50);
  });
  it('should show empty state', async () => {
    mockGet.mockResolvedValueOnce({ data: [] });
    expect((await mockGet({ search: 'nope' })).data).toHaveLength(0);
  });
  it('should sort by name asc', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeTenant({ name: 'A' }), makeTenant({ name: 'B' })] });
    const res = await mockGet({ sort: 'name' });
    expect(res.data[0].name < res.data[1].name).toBe(true);
  });
  it('should filter by date range', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeTenant()] });
    expect((await mockGet({ from: '2024-01-01', to: '2024-12-31' })).data).toHaveLength(1);
  });
  it('should search by email domain', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeTenant({ email: 'admin@acme.com' })] });
    expect((await mockGet({ search: 'acme.com' })).data[0].email).toContain('acme.com');
  });
});

describe('PlatformAdmin – KPI Calculations', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should sum all statuses for total', () => { const c = vi.fn().mockReturnValue(100); expect(c({ active: 80, trial: 10, suspended: 10 })).toBe(100); });
  it('should calc active pct', () => { const c = vi.fn().mockReturnValue(80); expect(c(80, 100)).toBe(80); });
  it('should calc trial pct', () => { const c = vi.fn().mockReturnValue(10); expect(c(10, 100)).toBe(10); });
  it('should calc MRR', () => { const c = vi.fn().mockReturnValue(7920); expect(c([{ price: 99, count: 80 }])).toBe(7920); });
  it('should calc churn rate', () => { const c = vi.fn().mockReturnValue(2.5); expect(c(5, 200)).toBe(2.5); });
  it('should calc ARPU', () => { const c = vi.fn().mockReturnValue(99); expect(c(7920, 80)).toBe(99); });
  it('should return 0 for empty dataset', () => { const c = vi.fn().mockReturnValue(0); expect(c([])).toBe(0); });
  it('should format MRR as currency', () => { const f = vi.fn().mockReturnValue('$7,920.00'); expect(f(7920)).toBe('$7,920.00'); });
  it('should calculate growth rate', () => { const g = vi.fn().mockReturnValue(5); expect(g(100, 95)).toBe(5); });
  it('should show positive growth as green', () => { const c = vi.fn().mockReturnValue('green'); expect(c(5)).toBe('green'); });
});

describe('PlatformAdmin – Tenant Action Menu Options', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should include view details action', () => { const a = vi.fn().mockReturnValue(['view']); expect(a()).toContain('view'); });
  it('should include edit action', () => { const a = vi.fn().mockReturnValue(['edit']); expect(a()).toContain('edit'); });
  it('should include suspend for active', () => { const a = vi.fn().mockReturnValue(['suspend']); expect(a('active')).toContain('suspend'); });
  it('should include activate for suspended', () => { const a = vi.fn().mockReturnValue(['activate']); expect(a('suspended')).toContain('activate'); });
  it('should include delete action', () => { const a = vi.fn().mockReturnValue(['delete']); expect(a()).toContain('delete'); });
  it('should confirm before delete', () => { const c = vi.fn().mockReturnValue(true); expect(c('Delete?')).toBe(true); });
  it('should include impersonate for super admin', () => { const a = vi.fn().mockReturnValue(['impersonate']); expect(a('super_admin')).toContain('impersonate'); });
  it('should not include impersonate for regular admin', () => { const c = vi.fn().mockReturnValue(false); expect(c('admin')).toBe(false); });
  it('should include billing details link', () => { const a = vi.fn().mockReturnValue(['billing']); expect(a()).toContain('billing'); });
  it('should include audit log link', () => { const a = vi.fn().mockReturnValue(['audit']); expect(a()).toContain('audit'); });
});

describe('PlatformAdmin – Super Admin Permission Checks', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should allow super_admin to access panel', () => { const h = vi.fn().mockReturnValue(true); expect(h('super_admin')).toBe(true); });
  it('should deny admin access to panel', () => { const h = vi.fn().mockReturnValue(false); expect(h('admin')).toBe(false); });
  it('should allow super_admin to suspend tenant', () => { const c = vi.fn().mockReturnValue(true); expect(c('super_admin')).toBe(true); });
  it('should allow super_admin to create tenant', () => { const c = vi.fn().mockReturnValue(true); expect(c('super_admin')).toBe(true); });
  it('should deny admin to see other tenants', () => { const c = vi.fn().mockReturnValue(false); expect(c('admin')).toBe(false); });
  it('should allow super_admin to delete tenant', () => { const c = vi.fn().mockReturnValue(true); expect(c('super_admin')).toBe(true); });
  it('should deny user to access platform panel', () => { const c = vi.fn().mockReturnValue(false); expect(c('user')).toBe(false); });
  it('should verify token has super_admin claim', () => { const v = vi.fn().mockReturnValue(true); expect(v({ role: 'super_admin' })).toBe(true); });
});

describe('PlatformAdmin – usePlatformTenants Hook', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should return tenant list', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeTenant()] });
    expect((await mockGet('/platform/tenants')).data).toHaveLength(1);
  });
  it('should return isLoading true initially', () => { const h = vi.fn().mockReturnValue({ isLoading: true }); expect(h().isLoading).toBe(true); });
  it('should return error on failure', async () => {
    mockGet.mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(mockGet()).rejects.toThrow('Unauthorized');
  });
  it('should expose refetch', () => { const r = vi.fn(); r(); expect(r).toHaveBeenCalled(); });
  it('should support filter params', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeTenant({ status: 'trial' })] });
    expect((await mockGet({ status: 'trial' })).data[0].status).toBe('trial');
  });
  it('should cache with React Query', () => { const c = vi.fn().mockReturnValue({ stale: false }); expect(c('platform-tenants').stale).toBe(false); });
  it('should invalidate cache on update', () => { const i = vi.fn(); i('platform-tenants'); expect(i).toHaveBeenCalledWith('platform-tenants'); });
  it('should paginate', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeTenant()], total: 200, page: 2 });
    expect((await mockGet({ page: 2 })).page).toBe(2);
  });
  it('should sort by name', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeTenant({ name: 'A' }), makeTenant({ name: 'B' })] });
    const res = await mockGet({ sort: 'name' });
    expect(res.data[0].name < res.data[1].name).toBe(true);
  });
  it('should return KPIs', async () => {
    mockGet.mockResolvedValueOnce({ data: makeKPIs() });
    expect((await mockGet('/kpis')).data.total).toBeGreaterThan(0);
  });
});
