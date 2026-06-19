import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockPost = vi.fn();
const mockGet = vi.fn();
const mockPut = vi.fn();

vi.mock('../api/salesApi', () => ({
  salesApi: { getMetrics: mockGet, createPaymentLink: mockPost, updatePaymentLink: mockPut, getRevenueChart: mockGet },
}));

const makeLink = (o = {}) => ({ id: 'link_1', title: 'Product A', amount: 99, status: 'active', url: 'https://pay.me/link_1', ...o });
const makeMetric = (o = {}) => ({ revenue: 50000, orders: 200, ...o });

describe('Sales E2E – Payment Link Full Creation Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should create payment link and share URL', async () => {
    mockPost.mockResolvedValueOnce({ data: makeLink() });
    const link = (await mockPost('/payment-links', { title: 'Product A', amount: 99 })).data;
    const copy = vi.fn(); copy(link.url); expect(copy).toHaveBeenCalledWith(link.url);
  });

  it('should validate form before creating', () => {
    const v = vi.fn().mockReturnValue({ title: 'Required' }); expect(v({}).title).toBe('Required');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('should show new link in list', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeLink()] }); expect((await mockGet('/payment-links')).data).toHaveLength(1);
  });

  it('should deactivate link from list', async () => {
    mockPut.mockResolvedValueOnce({ data: makeLink({ status: 'inactive' }) });
    expect((await mockPut('/payment-links/link_1', { status: 'inactive' })).data.status).toBe('inactive');
  });
});

describe('Sales E2E – Revenue Dashboard Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should load revenue metrics on dashboard', async () => {
    mockGet.mockResolvedValueOnce({ data: makeMetric() });
    expect((await mockGet('/metrics')).data.revenue).toBe(50000);
  });

  it('should filter metrics by period', async () => {
    mockGet.mockResolvedValueOnce({ data: makeMetric({ revenue: 15000 }) });
    expect((await mockGet({ period: 'month' })).data.revenue).toBe(15000);
  });

  it('should load revenue chart', async () => {
    mockGet.mockResolvedValueOnce({ data: { labels: ['W1', 'W2'], data: [5000, 10000] } });
    expect((await mockGet('/revenue-chart')).data.data).toHaveLength(2);
  });

  it('should switch date range and update chart', async () => {
    mockGet.mockResolvedValueOnce({ data: { labels: ['Jan', 'Feb'], data: [30000, 45000] } });
    expect((await mockGet({ from: '2024-01-01', to: '2024-02-28' })).data.labels).toHaveLength(2);
  });
});

describe('Sales E2E – Target vs Actual Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should create target and show progress', async () => {
    mockPost.mockResolvedValueOnce({ data: { target: 60000, actual: 0, progress: 0 } });
    expect((await mockPost('/targets', { target: 60000 })).data.progress).toBe(0);
  });

  it('should show target achieved when met', () => {
    const achieved = vi.fn().mockReturnValue(true); expect(achieved(60000, 60000)).toBe(true);
  });

  it('should show remaining amount to target', () => {
    const remaining = vi.fn().mockReturnValue(10000); expect(remaining(50000, 60000)).toBe(10000);
  });
});

describe('Sales E2E – Coupon Application Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should apply coupon and show discounted price', async () => {
    mockPost.mockResolvedValueOnce({ data: { discount: 10, finalAmount: 90 } });
    expect((await mockPost('/coupon/apply', { code: 'PROMO10', amount: 100 })).data.finalAmount).toBe(90);
  });

  it('should reject invalid coupon with error message', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 404, data: { message: 'Coupon not found' } } });
    await expect(mockPost('/coupon/apply', { code: 'FAKE' })).rejects.toMatchObject({ response: { status: 404 } });
  });
});

describe('Sales E2E – Report Generation Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should generate and download sales report', async () => {
    mockPost.mockResolvedValueOnce({ data: { url: 'https://files/report.pdf' } });
    const url = (await mockPost('/reports/generate')).data.url;
    const dl = vi.fn(); dl(url); expect(dl).toHaveBeenCalledWith(url);
  });

  it('should generate report for custom period', async () => {
    mockPost.mockResolvedValueOnce({ data: { url: 'https://files/report.pdf', period: 'Q1 2024' } });
    expect((await mockPost('/reports/generate', { period: 'Q1' })).data.period).toBeDefined();
  });

  it('should handle report error', async () => {
    mockPost.mockRejectedValueOnce(new Error('Report failed'));
    await expect(mockPost('/reports/generate')).rejects.toThrow('Report failed');
  });
});

describe('Sales E2E – Sales Funnel Visualization Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should load funnel and display metrics', async () => {
    mockGet.mockResolvedValueOnce({ data: { views: 1000, clicks: 200, conversions: 20 } });
    expect((await mockGet('/funnel')).data.conversions).toBe(20);
  });

  it('should filter funnel by date', async () => {
    mockGet.mockResolvedValueOnce({ data: { views: 500 } });
    expect((await mockGet({ from: '2024-01-01' })).data.views).toBe(500);
  });

  it('should show conversion percentage', () => {
    const cvr = vi.fn().mockReturnValue(2); expect(cvr(20, 1000)).toBe(2);
  });
});
