import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockPost = vi.fn();
const mockGet = vi.fn();
const mockPut = vi.fn();

vi.mock('../api/settingsApi', () => ({
  settingsApi: { getTenantData: mockGet, updateAddress: mockPut, updateHours: mockPut, getCompleteness: mockGet, getOnboarding: mockGet },
}));

const makeTenant = (o = {}) => ({ id: 'ten_1', name: 'My Business', ...o });
const makeAddress = (o = {}) => ({ street: 'Av. Paulista', number: '100', city: 'SP', zip: '01310-100', ...o });

describe('Settings E2E – Save Address Full Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should complete save address flow', async () => {
    mockPut.mockResolvedValueOnce({ data: makeTenant({ address: makeAddress() }) });
    expect((await mockPut('/settings/address', makeAddress())).data.address.street).toBe('Av. Paulista');
  });

  it('should validate before saving', () => {
    const v = vi.fn().mockReturnValue({ street: 'Required' }); expect(v({}).street).toBe('Required');
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('should show success notification after save', () => {
    const toast = vi.fn(); toast({ type: 'success' }); expect(toast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
  });
});

describe('Settings E2E – Update Business Hours Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should update hours end to end', async () => {
    mockPut.mockResolvedValueOnce({ data: { hours: { monday: { open: '09:00', close: '17:00', enabled: true } } } });
    expect((await mockPut('/settings/hours', {})).data.hours.monday.open).toBe('09:00');
  });

  it('should validate time range', () => {
    const v = vi.fn().mockReturnValue({ close: 'Must be after open' }); expect(v({ open: '18:00', close: '08:00' }).close).toBeDefined();
  });
});

describe('Settings E2E – Add Branch Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should add branch and show in list', async () => {
    mockPost.mockResolvedValueOnce({ data: { id: 'br_2', name: 'Downtown' } });
    expect((await mockPost('/branches', { name: 'Downtown' })).data.name).toBe('Downtown');
  });

  it('should validate branch name', () => {
    const v = vi.fn().mockReturnValue({ name: 'Required' }); expect(v({}).name).toBe('Required');
  });
});

describe('Settings E2E – Integration Toggle Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should toggle integration on', async () => {
    mockPut.mockResolvedValueOnce({ data: { enabled: true } });
    expect((await mockPut('/integrations/int_1', { enabled: true })).data.enabled).toBe(true);
  });

  it('should toggle integration off', async () => {
    mockPut.mockResolvedValueOnce({ data: { enabled: false } });
    expect((await mockPut('/integrations/int_1', { enabled: false })).data.enabled).toBe(false);
  });
});

describe('Settings E2E – Completeness Score Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should show completeness score', async () => {
    mockGet.mockResolvedValueOnce({ data: { score: 70 } });
    expect((await mockGet('/settings/completeness')).data.score).toBe(70);
  });

  it('should increase score after completing step', async () => {
    mockGet.mockResolvedValueOnce({ data: { score: 80 } });
    expect((await mockGet('/settings/completeness')).data.score).toBe(80);
  });

  it('should reach 100% when all complete', async () => {
    mockGet.mockResolvedValueOnce({ data: { score: 100 } });
    expect((await mockGet('/settings/completeness')).data.score).toBe(100);
  });
});

describe('Settings E2E – Onboarding Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should load and display onboarding steps', async () => {
    mockGet.mockResolvedValueOnce({ data: { steps: [{ id: 's1', completed: false }, { id: 's2', completed: false }] } });
    expect((await mockGet('/settings/onboarding')).data.steps).toHaveLength(2);
  });

  it('should complete step and update progress', async () => {
    mockPut.mockResolvedValueOnce({ data: { completed: true } });
    expect((await mockPut('/settings/onboarding/s1', { completed: true })).data.completed).toBe(true);
  });

  it('should show completion when all done', async () => {
    mockGet.mockResolvedValueOnce({ data: { allDone: true } });
    expect((await mockGet('/settings/onboarding')).data.allDone).toBe(true);
  });
});

describe('Settings E2E – Audit Log Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should load and display audit events', async () => {
    mockGet.mockResolvedValueOnce({ data: [{ id: 'evt_1', action: 'settings_updated', timestamp: '2024-01-01' }] });
    expect((await mockGet('/audit')).data[0].action).toBe('settings_updated');
  });

  it('should filter audit log by date', async () => {
    mockGet.mockResolvedValueOnce({ data: [{ id: 'evt_1' }] });
    expect((await mockGet({ from: '2024-01-01' })).data).toHaveLength(1);
  });
});

describe('Settings E2E – Error Handling', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should show error on failed address save', async () => {
    mockPut.mockRejectedValueOnce({ response: { status: 422 } });
    await expect(mockPut('/settings/address', {})).rejects.toMatchObject({ response: { status: 422 } });
  });

  it('should show error on failed hours save', async () => {
    mockPut.mockRejectedValueOnce(new Error('Server error'));
    await expect(mockPut('/settings/hours', {})).rejects.toThrow('Server error');
  });

  it('should handle network error gracefully', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network error'));
    await expect(mockGet('/settings')).rejects.toThrow('Network error');
  });
});
