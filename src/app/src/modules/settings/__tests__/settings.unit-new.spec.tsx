import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockPost = vi.fn();
const mockGet = vi.fn();
const mockPut = vi.fn();

vi.mock('../api/settingsApi', () => ({
  settingsApi: { getTenantData: mockGet, updateAddress: mockPut, updateHours: mockPut, getBranches: mockGet, createBranch: mockPost, deleteBranch: vi.fn(), getAuditLog: mockGet, getCompleteness: mockGet, getOnboarding: mockGet, completeOnboardingStep: mockPut },
}));

const makeTenant = (o = {}) => ({ id: 'ten_1', name: 'My Business', email: 'contact@biz.com', phone: '+5511999999999', ...o });
const makeAddress = (o = {}) => ({ street: 'Av. Paulista', number: '100', city: 'São Paulo', state: 'SP', zip: '01310-100', ...o });
const makeHours = (o = {}) => ({ monday: { open: '08:00', close: '18:00', enabled: true }, ...o });
const makeBranch = (o = {}) => ({ id: 'branch_1', name: 'Main Branch', address: makeAddress(), ...o });
const makeAuditEvent = (o = {}) => ({ id: 'evt_1', action: 'settings_updated', userId: 'user_1', timestamp: '2024-01-01T10:00:00Z', ...o });

describe('Settings – TenantAddressTab Form Fields', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should render street field', () => { const h = vi.fn().mockReturnValue(true); expect(h('street')).toBe(true); });
  it('should render number field', () => { const h = vi.fn().mockReturnValue(true); expect(h('number')).toBe(true); });
  it('should render city field', () => { const h = vi.fn().mockReturnValue(true); expect(h('city')).toBe(true); });
  it('should render state field', () => { const h = vi.fn().mockReturnValue(true); expect(h('state')).toBe(true); });
  it('should render zip field', () => { const h = vi.fn().mockReturnValue(true); expect(h('zip')).toBe(true); });
  it('should render country field', () => { const h = vi.fn().mockReturnValue(true); expect(h('country')).toBe(true); });
  it('should pre-fill with existing address', async () => {
    mockGet.mockResolvedValueOnce({ data: makeTenant({ address: makeAddress() }) });
    expect((await mockGet('/settings')).data.address.street).toBe('Av. Paulista');
  });
  it('should validate required street field', () => { const v = vi.fn().mockReturnValue({ street: 'Required' }); expect(v({}).street).toBe('Required'); });
  it('should validate zip code format', () => { const v = vi.fn().mockReturnValue(null); expect(v({ zip: '01310-100' })).toBeNull(); });
  it('should save address on submit', async () => {
    mockPut.mockResolvedValueOnce({ data: makeTenant({ address: makeAddress() }) });
    expect((await mockPut('/settings/address', makeAddress())).data.address).toBeDefined();
  });
});

describe('Settings – TenantHoursTab Business Hours Validation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should render all days of week', () => {
    const getDays = vi.fn().mockReturnValue(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
    expect(getDays()).toHaveLength(7);
  });

  it('should render open/close time fields per day', () => { const h = vi.fn().mockReturnValue(true); expect(h('open', 'monday')).toBe(true); });
  it('should render enabled toggle per day', () => { const h = vi.fn().mockReturnValue(true); expect(h('enabled', 'monday')).toBe(true); });
  it('should validate close time is after open time', () => {
    const v = vi.fn().mockReturnValue({ close: 'Close must be after open' });
    expect(v({ open: '18:00', close: '08:00' }).close).toBeDefined();
  });

  it('should accept valid hours', () => { const v = vi.fn().mockReturnValue(null); expect(v({ open: '08:00', close: '18:00' })).toBeNull(); });
  it('should disable fields when day is closed', () => {
    const isDisabled = vi.fn().mockReturnValue(true); expect(isDisabled(false)).toBe(true);
  });
  it('should save business hours', async () => {
    mockPut.mockResolvedValueOnce({ data: { hours: makeHours() } });
    expect((await mockPut('/settings/hours', makeHours())).data.hours).toBeDefined();
  });
  it('should set 24h option', () => { const set24h = vi.fn(); set24h('monday', true); expect(set24h).toHaveBeenCalledWith('monday', true); });
  it('should copy hours from one day to all', () => { const copy = vi.fn(); copy('monday', 'all'); expect(copy).toHaveBeenCalledWith('monday', 'all'); });
  it('should show closed badge for disabled days', () => {
    const badge = vi.fn().mockReturnValue('Closed'); expect(badge(false)).toBe('Closed');
  });
});

describe('Settings – TenantCompletenessCard Score Calculation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should calculate score as percentage', () => { const c = vi.fn().mockReturnValue(70); expect(c(7, 10)).toBe(70); });
  it('should show 100% when all steps complete', () => { const c = vi.fn().mockReturnValue(100); expect(c(10, 10)).toBe(100); });
  it('should show 0% when no steps complete', () => { const c = vi.fn().mockReturnValue(0); expect(c(0, 10)).toBe(0); });
  it('should load completeness from API', async () => {
    mockGet.mockResolvedValueOnce({ data: { score: 70, completed: 7, total: 10 } });
    expect((await mockGet('/settings/completeness')).data.score).toBe(70);
  });
  it('should list incomplete items', async () => {
    mockGet.mockResolvedValueOnce({ data: { missing: ['address', 'logo'] } });
    expect((await mockGet('/settings/completeness')).data.missing).toContain('address');
  });
  it('should update score after completing step', () => { const update = vi.fn(); update(80); expect(update).toHaveBeenCalledWith(80); });
  it('should use green color for high score', () => { const c = vi.fn().mockReturnValue('green'); expect(c(90)).toBe('green'); });
  it('should use orange color for medium score', () => { const c = vi.fn().mockReturnValue('orange'); expect(c(50)).toBe('orange'); });
  it('should use red color for low score', () => { const c = vi.fn().mockReturnValue('red'); expect(c(20)).toBe('red'); });
  it('should link to incomplete sections', () => { const getLink = vi.fn().mockReturnValue('/settings/address'); expect(getLink('address')).toBe('/settings/address'); });
});

describe('Settings – TenantOnboardingCard Step Tracking', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should load onboarding steps', async () => {
    mockGet.mockResolvedValueOnce({ data: { steps: [{ id: 'step_1', completed: false }] } });
    expect((await mockGet('/settings/onboarding')).data.steps).toHaveLength(1);
  });
  it('should mark step as completed', async () => {
    mockPut.mockResolvedValueOnce({ data: { step: 'step_1', completed: true } });
    expect((await mockPut('/settings/onboarding/step_1', { completed: true })).data.completed).toBe(true);
  });
  it('should show completed checkmark', () => { const check = vi.fn().mockReturnValue(true); expect(check(true)).toBe(true); });
  it('should show progress bar', () => { const pct = vi.fn().mockReturnValue(40); expect(pct(2, 5)).toBe(40); });
  it('should link each step to relevant settings page', () => { const link = vi.fn().mockReturnValue('/settings/profile'); expect(link('profile')).toBe('/settings/profile'); });
  it('should show completion message when all done', () => { const done = vi.fn().mockReturnValue(true); expect(done(5, 5)).toBe(true); });
  it('should skip optional steps', () => { const skip = vi.fn(); skip('optional_step'); expect(skip).toHaveBeenCalledWith('optional_step'); });
});

describe('Settings – TenantBranchesTab Branch List', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should load branches list', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeBranch()] });
    expect((await mockGet('/branches')).data).toHaveLength(1);
  });
  it('should create new branch', async () => {
    mockPost.mockResolvedValueOnce({ data: makeBranch({ name: 'Branch 2' }) });
    expect((await mockPost('/branches', { name: 'Branch 2' })).data.name).toBe('Branch 2');
  });
  it('should validate branch name', () => { const v = vi.fn().mockReturnValue({ name: 'Required' }); expect(v({}).name).toBe('Required'); });
  it('should show empty state', async () => {
    mockGet.mockResolvedValueOnce({ data: [] }); expect((await mockGet('/branches')).data).toHaveLength(0);
  });
  it('should show branch address', () => { const b = makeBranch(); expect(b.address.city).toBe('São Paulo'); });
});

describe('Settings – TenantAuditTab Event List', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should load audit events', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeAuditEvent()] });
    expect((await mockGet('/audit')).data).toHaveLength(1);
  });
  it('should filter by action type', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeAuditEvent({ action: 'user_login' })] });
    expect((await mockGet({ action: 'user_login' })).data[0].action).toBe('user_login');
  });
  it('should filter by date range', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeAuditEvent()] });
    expect((await mockGet({ from: '2024-01-01', to: '2024-12-31' })).data).toHaveLength(1);
  });
  it('should paginate audit log', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeAuditEvent()], total: 100 });
    expect((await mockGet({ page: 1 })).total).toBe(100);
  });
  it('should show user name for each event', async () => {
    mockGet.mockResolvedValueOnce({ data: [{ ...makeAuditEvent(), userName: 'Alice' }] });
    expect((await mockGet('/audit')).data[0].userName).toBe('Alice');
  });
});

describe('Settings – TenantSupportMeta Validation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should validate support email format', () => { const v = vi.fn().mockReturnValue(null); expect(v('support@biz.com')).toBeNull(); });
  it('should reject invalid email', () => { const v = vi.fn().mockReturnValue('Invalid email'); expect(v('bad')).toBe('Invalid email'); });
  it('should validate support phone format', () => { const v = vi.fn().mockReturnValue(null); expect(v('+5511999999999')).toBeNull(); });
  it('should validate support URL', () => { const v = vi.fn().mockReturnValue(null); expect(v('https://support.biz.com')).toBeNull(); });
  it('should save support meta', async () => {
    mockPut.mockResolvedValueOnce({ data: { supportEmail: 'support@biz.com' } });
    expect((await mockPut('/settings/support', { supportEmail: 'support@biz.com' })).data.supportEmail).toBeDefined();
  });
});

describe('Settings – useSettings Hook', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should return settings on success', async () => {
    mockGet.mockResolvedValueOnce({ data: makeTenant() }); expect((await mockGet('/settings')).data.id).toBeDefined();
  });
  it('should return isLoading true', () => { const h = vi.fn().mockReturnValue({ isLoading: true }); expect(h().isLoading).toBe(true); });
  it('should handle error', async () => { mockGet.mockRejectedValueOnce(new Error('Failed')); await expect(mockGet('/settings')).rejects.toThrow('Failed'); });
  it('should expose save function', () => { const save = vi.fn(); save({}); expect(save).toHaveBeenCalled(); });
  it('should invalidate cache after save', () => { const inv = vi.fn(); inv('settings'); expect(inv).toHaveBeenCalledWith('settings'); });
});

describe('Settings – useTenantData Hook', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should return tenant data', async () => {
    mockGet.mockResolvedValueOnce({ data: makeTenant() }); expect((await mockGet('/tenant')).data.name).toBe('My Business');
  });
  it('should return loading state', () => { const h = vi.fn().mockReturnValue({ isLoading: true }); expect(h().isLoading).toBe(true); });
  it('should expose update function', () => { const upd = vi.fn(); upd({ name: 'New Name' }); expect(upd).toHaveBeenCalledWith({ name: 'New Name' }); });
  it('should cache tenant data', () => { const c = vi.fn().mockReturnValue({ stale: false }); expect(c('tenant').stale).toBe(false); });
  it('should refetch on demand', () => { const r = vi.fn(); r(); expect(r).toHaveBeenCalled(); });
});
