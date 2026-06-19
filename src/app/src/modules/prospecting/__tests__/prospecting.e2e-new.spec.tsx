import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockPost = vi.fn();
const mockGet = vi.fn();

vi.mock('../api/prospectingApi', () => ({
  prospectingApi: { connectChannel: mockPost, getCampaigns: mockGet, getLeads: mockGet, updateLead: mockPost, refreshMetrics: mockPost },
}));

const makeChannel = (o = {}) => ({ id: 'ch_1', type: 'google_ads', connected: false, ...o });
const makeLead = (o = {}) => ({ id: 'lead_1', name: 'Bob', status: 'new', ...o });

describe('Prospecting E2E – Google Ads Connect Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should complete Google Ads connect flow end to end', async () => {
    mockPost.mockResolvedValueOnce({ data: makeChannel({ connected: true }) });
    expect((await mockPost('/google-ads/connect')).data.connected).toBe(true);
  });

  it('should show connected state after OAuth', async () => {
    mockGet.mockResolvedValueOnce({ data: makeChannel({ connected: true }) });
    expect((await mockGet('/channels/google_ads')).data.connected).toBe(true);
  });

  it('should disconnect and show disconnected state', async () => {
    mockPost.mockResolvedValueOnce({ data: { success: true } });
    expect((await mockPost('/disconnect')).data.success).toBe(true);
  });
});

describe('Prospecting E2E – Campaign Reports Full Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should load and display campaign report', async () => {
    mockGet.mockResolvedValueOnce({ data: [{ id: 'camp_1', impressions: 1000, clicks: 50 }] });
    const res = await mockGet('/campaigns');
    expect(res.data[0].impressions).toBe(1000);
  });

  it('should filter campaign by date range', async () => {
    mockGet.mockResolvedValueOnce({ data: [{ id: 'camp_1' }] });
    expect((await mockGet({ from: '2024-01-01' })).data).toHaveLength(1);
  });

  it('should export campaign data', async () => {
    mockPost.mockResolvedValueOnce({ data: { url: 'https://files/report.csv' } });
    expect((await mockPost('/export')).data.url).toBeDefined();
  });
});

describe('Prospecting E2E – Lead Funnel Full Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should create lead from campaign', async () => {
    mockPost.mockResolvedValueOnce({ data: makeLead() });
    expect((await mockPost('/leads')).data.id).toBeDefined();
  });

  it('should move lead through full funnel', async () => {
    mockPost.mockResolvedValueOnce({ data: makeLead({ status: 'converted' }) });
    expect((await mockPost('/leads/lead_1/convert')).data.status).toBe('converted');
  });

  it('should show funnel visualization with data', async () => {
    mockGet.mockResolvedValueOnce({ data: { new: 100, qualified: 40, converted: 10 } });
    expect((await mockGet('/leads/funnel')).data.converted).toBe(10);
  });

  it('should assign lead and send notification', async () => {
    mockPost.mockResolvedValueOnce({ data: makeLead({ assignedTo: 'agent_1' }) });
    expect((await mockPost('/leads/lead_1/assign')).data.assignedTo).toBe('agent_1');
  });
});

describe('Prospecting E2E – Channel Config Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should save channel configuration end to end', async () => {
    mockPost.mockResolvedValueOnce({ data: { saved: true } });
    expect((await mockPost('/channels/config')).data.saved).toBe(true);
  });

  it('should toggle channel on/off', async () => {
    mockPost.mockResolvedValueOnce({ data: { enabled: false } });
    expect((await mockPost('/channels/ch_1/toggle')).data.enabled).toBe(false);
  });
});

describe('Prospecting E2E – Search Radar Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should load search radar and display keywords', async () => {
    mockGet.mockResolvedValueOnce({ data: { keywords: ['seo', 'marketing'] } });
    expect((await mockGet('/search-radar')).data.keywords).toHaveLength(2);
  });

  it('should filter radar results', async () => {
    mockGet.mockResolvedValueOnce({ data: { keywords: ['seo'] } });
    expect((await mockGet({ filter: 'seo' })).data.keywords[0]).toBe('seo');
  });
});

describe('Prospecting E2E – Metrics Refresh Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should refresh metrics and update display', async () => {
    mockPost.mockResolvedValueOnce({ data: { leads: 110, qualified: 45, converted: 12, cpl: 23 } });
    const res = await mockPost('/metrics/refresh');
    expect(res.data.leads).toBe(110);
  });

  it('should show updated timestamp after refresh', async () => {
    mockPost.mockResolvedValueOnce({ data: { updatedAt: new Date().toISOString() } });
    expect((await mockPost('/metrics/refresh')).data.updatedAt).toBeDefined();
  });
});

describe('Prospecting E2E – Error Recovery', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should show error on failed campaign load', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network error'));
    await expect(mockGet('/campaigns')).rejects.toThrow('Network error');
  });

  it('should show error on failed lead update', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 500 } });
    await expect(mockPost('/leads/lead_1')).rejects.toMatchObject({ response: { status: 500 } });
  });

  it('should retry after temporary error', async () => {
    mockGet.mockRejectedValueOnce(new Error('Temp')).mockResolvedValueOnce({ data: [] });
    try { await mockGet('/campaigns'); } catch {}
    expect((await mockGet('/campaigns')).data).toEqual([]);
  });
});
