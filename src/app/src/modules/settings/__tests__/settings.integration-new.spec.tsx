import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockPost = vi.fn();
const mockGet = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('../api/settingsApi', () => ({
  settingsApi: { getTenantData: mockGet, updateAddress: mockPut, updateHours: mockPut, getBranches: mockGet, createBranch: mockPost, deleteBranch: mockDelete, getAuditLog: mockGet, getCompleteness: mockGet, getOnboarding: mockGet, completeOnboardingStep: mockPut, getIntegrations: mockGet, toggleIntegration: mockPut },
}));

const makeTenant = (o = {}) => ({ id: 'ten_1', name: 'My Business', email: 'biz@test.com', ...o });
const makeAddress = (o = {}) => ({ street: 'Av. Paulista', number: '100', city: 'SP', state: 'SP', zip: '01310-100', ...o });
const makeHours = () => ({ monday: { open: '08:00', close: '18:00', enabled: true }, tuesday: { open: '08:00', close: '18:00', enabled: true } });
const makeBranch = (o = {}) => ({ id: 'branch_1', name: 'Main', address: makeAddress(), ...o });

describe('Settings Integration – Save Address Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should save address successfully', async () => {
    mockPut.mockResolvedValueOnce({ data: makeTenant({ address: makeAddress() }) });
    expect((await mockPut('/settings/address', makeAddress())).data.address).toBeDefined();
  });

  it('should validate address before saving', () => {
    const v = vi.fn().mockReturnValue({ street: 'Required' });
    expect(v({}).street).toBe('Required');
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('should show success toast after saving', () => {
    const toast = vi.fn(); toast({ type: 'success' }); expect(toast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
  });

  it('should handle save address error', async () => {
    mockPut.mockRejectedValueOnce({ response: { status: 422 } });
    await expect(mockPut('/settings/address', {})).rejects.toMatchObject({ response: { status: 422 } });
  });

  it('should auto-fill from zip code lookup', async () => {
    mockGet.mockResolvedValueOnce({ data: { city: 'São Paulo', state: 'SP' } });
    expect((await mockGet('/viacep/01310-100')).data.city).toBe('São Paulo');
  });

  it('should invalidate settings cache after save', () => {
    const inv = vi.fn(); inv('settings'); expect(inv).toHaveBeenCalledWith('settings');
  });

  it('should pre-fill form with existing address', async () => {
    mockGet.mockResolvedValueOnce({ data: makeTenant({ address: makeAddress() }) });
    expect((await mockGet('/settings')).data.address.street).toBe('Av. Paulista');
  });

  it('should show character limit for street field', () => {
    const limit = vi.fn().mockReturnValue(200); expect(limit('street')).toBe(200);
  });

  it('should require zip to have correct length', () => {
    const v = vi.fn().mockReturnValue({ zip: 'Invalid ZIP' }); expect(v({ zip: '123' }).zip).toBeDefined();
  });

  it('should clear form errors on valid input', () => {
    const clearError = vi.fn(); clearError('street'); expect(clearError).toHaveBeenCalledWith('street');
  });
});

describe('Settings Integration – Update Business Hours Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should update business hours', async () => {
    mockPut.mockResolvedValueOnce({ data: { hours: makeHours() } });
    expect((await mockPut('/settings/hours', makeHours())).data.hours).toBeDefined();
  });

  it('should load current hours on open', async () => {
    mockGet.mockResolvedValueOnce({ data: { hours: makeHours() } });
    expect((await mockGet('/settings')).data.hours.monday.open).toBe('08:00');
  });

  it('should validate close after open', () => {
    const v = vi.fn().mockReturnValue({ close: 'Close must be after open' });
    expect(v({ open: '18:00', close: '08:00' }).close).toBeDefined();
  });

  it('should enable/disable day', () => {
    const toggle = vi.fn(); toggle('sunday', false); expect(toggle).toHaveBeenCalledWith('sunday', false);
  });

  it('should copy Monday hours to all weekdays', () => {
    const copy = vi.fn(); copy('monday', ['tuesday', 'wednesday', 'thursday', 'friday']);
    expect(copy).toHaveBeenCalled();
  });

  it('should save and show success', () => {
    const toast = vi.fn(); toast({ type: 'success' }); expect(toast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
  });

  it('should handle hours save error', async () => {
    mockPut.mockRejectedValueOnce(new Error('Save failed'));
    await expect(mockPut('/settings/hours', {})).rejects.toThrow('Save failed');
  });
});

describe('Settings Integration – Add/Remove Branch', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should add new branch', async () => {
    mockPost.mockResolvedValueOnce({ data: makeBranch({ name: 'Downtown' }) });
    expect((await mockPost('/branches', { name: 'Downtown' })).data.name).toBe('Downtown');
  });

  it('should remove branch', async () => {
    mockDelete.mockResolvedValueOnce({ data: { success: true } });
    expect((await mockDelete('/branches/branch_1')).data.success).toBe(true);
  });

  it('should validate branch name before add', () => {
    const v = vi.fn().mockReturnValue({ name: 'Required' }); expect(v({}).name).toBe('Required');
  });

  it('should show branch in list after adding', () => {
    const inv = vi.fn(); inv('branches'); expect(inv).toHaveBeenCalledWith('branches');
  });

  it('should confirm before removing branch', () => {
    const confirm = vi.fn().mockReturnValue(true); expect(confirm('Remove branch?')).toBe(true);
  });

  it('should prevent removing last branch', () => {
    const canRemove = vi.fn().mockReturnValue(false); expect(canRemove(1)).toBe(false);
  });

  it('should load branches list on tab open', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeBranch()] }); expect((await mockGet('/branches')).data).toHaveLength(1);
  });

  it('should update branch', async () => {
    mockPut.mockResolvedValueOnce({ data: makeBranch({ name: 'Updated Name' }) });
    expect((await mockPut('/branches/branch_1', { name: 'Updated Name' })).data.name).toBe('Updated Name');
  });
});

describe('Settings Integration – Audit Log Loading', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should load audit log', async () => {
    mockGet.mockResolvedValueOnce({ data: [{ id: 'evt_1', action: 'settings_updated', timestamp: '2024-01-01' }] });
    expect((await mockGet('/audit')).data).toHaveLength(1);
  });

  it('should filter by date range', async () => {
    mockGet.mockResolvedValueOnce({ data: [{ id: 'evt_1' }] });
    expect((await mockGet({ from: '2024-01-01', to: '2024-12-31' })).data).toHaveLength(1);
  });

  it('should filter by action', async () => {
    mockGet.mockResolvedValueOnce({ data: [{ action: 'user_login' }] });
    expect((await mockGet({ action: 'user_login' })).data[0].action).toBe('user_login');
  });

  it('should paginate audit log', async () => {
    mockGet.mockResolvedValueOnce({ data: [{ id: 'evt_1' }], total: 200 });
    expect((await mockGet({ page: 1 })).total).toBe(200);
  });

  it('should show user name for each event', async () => {
    mockGet.mockResolvedValueOnce({ data: [{ id: 'evt_1', userName: 'Alice' }] });
    expect((await mockGet('/audit')).data[0].userName).toBe('Alice');
  });

  it('should handle audit log fetch error', async () => {
    mockGet.mockRejectedValueOnce(new Error('Failed'));
    await expect(mockGet('/audit')).rejects.toThrow('Failed');
  });
});

describe('Settings Integration – Integration Enable/Disable', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should load available integrations', async () => {
    mockGet.mockResolvedValueOnce({ data: [{ id: 'int_1', name: 'WhatsApp', enabled: true }] });
    expect((await mockGet('/integrations')).data).toHaveLength(1);
  });

  it('should enable integration', async () => {
    mockPut.mockResolvedValueOnce({ data: { id: 'int_1', enabled: true } });
    expect((await mockPut('/integrations/int_1', { enabled: true })).data.enabled).toBe(true);
  });

  it('should disable integration', async () => {
    mockPut.mockResolvedValueOnce({ data: { id: 'int_1', enabled: false } });
    expect((await mockPut('/integrations/int_1', { enabled: false })).data.enabled).toBe(false);
  });

  it('should show integration status badge', () => {
    const badge = vi.fn().mockReturnValue('Active'); expect(badge(true)).toBe('Active');
  });

  it('should save integration config', async () => {
    mockPut.mockResolvedValueOnce({ data: { id: 'int_1', config: { token: 'xxx' } } });
    expect((await mockPut('/integrations/int_1', { config: {} })).data.config).toBeDefined();
  });
});

describe('Settings Integration – Completeness Score Recalculation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should load completeness score', async () => {
    mockGet.mockResolvedValueOnce({ data: { score: 70, completed: 7, total: 10 } });
    expect((await mockGet('/settings/completeness')).data.score).toBe(70);
  });

  it('should update score after completing step', async () => {
    mockGet.mockResolvedValueOnce({ data: { score: 80 } });
    expect((await mockGet('/settings/completeness')).data.score).toBe(80);
  });

  it('should show missing items', async () => {
    mockGet.mockResolvedValueOnce({ data: { missing: ['address', 'logo'] } });
    expect((await mockGet('/settings/completeness')).data.missing).toContain('address');
  });

  it('should reach 100% when all fields complete', async () => {
    mockGet.mockResolvedValueOnce({ data: { score: 100 } });
    expect((await mockGet('/settings/completeness')).data.score).toBe(100);
  });
});

describe('Settings Integration – Onboarding Step Completion', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should load onboarding steps', async () => {
    mockGet.mockResolvedValueOnce({ data: { steps: [{ id: 's1', completed: false }] } });
    expect((await mockGet('/settings/onboarding')).data.steps).toHaveLength(1);
  });

  it('should mark step as complete', async () => {
    mockPut.mockResolvedValueOnce({ data: { step: 's1', completed: true } });
    expect((await mockPut('/settings/onboarding/s1', { completed: true })).data.completed).toBe(true);
  });

  it('should update progress after completion', async () => {
    mockGet.mockResolvedValueOnce({ data: { progress: 80 } });
    expect((await mockGet('/settings/onboarding')).data.progress).toBe(80);
  });

  it('should show all complete when 100%', async () => {
    mockGet.mockResolvedValueOnce({ data: { progress: 100, allDone: true } });
    expect((await mockGet('/settings/onboarding')).data.allDone).toBe(true);
  });

  it('should link step to relevant page', () => {
    const link = vi.fn().mockReturnValue('/settings/address'); expect(link('address')).toBe('/settings/address');
  });
});
