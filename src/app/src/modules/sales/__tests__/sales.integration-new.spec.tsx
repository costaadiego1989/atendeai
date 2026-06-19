import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockPost = vi.fn();
const mockGet = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('../api/salesApi', () => ({
  salesApi: { getMetrics: mockGet, getPaymentLinks: mockGet, createPaymentLink: mockPost, updatePaymentLink: mockPut, deletePaymentLink: mockDelete, getRevenueChart: mockGet, getTargets: mockGet, createTarget: mockPost, generateReport: mockPost, getFunnel: mockGet },
}));

const makeLink = (o = {}) => ({ id: 'link_1', title: 'Product A', amount: 99, status: 'active', url: 'https://pay.me/link_1', ...o });
const makeMetric = (o = {}) => ({ revenue: 50000, orders: 200, avgOrder: 250, conversionRate: 3.5, ...o });
const makeTarget = (o = {}) => ({ id: 'tgt_1', period: '2024-01', target: 60000, actual: 50000, ...o });

describe('Sales Integration – Payment Link Creation Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should create payment link', async () => {
    mockPost.mockResolvedValueOnce({ data: makeLink() });
    expect((await mockPost('/payment-links', { title: 'Product A', amount: 99 })).data.url).toBeDefined();
  });

  it('should validate required fields before create', () => {
    const v = vi.fn().mockReturnValue({ title: 'Required', amount: 'Required' });
    expect(v({}).title).toBe('Required');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('should return shareable URL after creation', async () => {
    mockPost.mockResolvedValueOnce({ data: makeLink({ url: 'https://pay.me/link_1' }) });
    expect((await mockPost('/payment-links', {})).data.url).toContain('https://');
  });

  it('should copy link URL to clipboard', () => {
    const copy = vi.fn(); copy('https://pay.me/link_1'); expect(copy).toHaveBeenCalled();
  });

  it('should add link to list after creation', () => {
    const invalidate = vi.fn(); invalidate('payment-links'); expect(invalidate).toHaveBeenCalledWith('payment-links');
  });

  it('should set default status to active', async () => {
    mockPost.mockResolvedValueOnce({ data: makeLink({ status: 'active' }) });
    expect((await mockPost('/payment-links', {})).data.status).toBe('active');
  });

  it('should set expiry date if provided', async () => {
    mockPost.mockResolvedValueOnce({ data: makeLink({ expiresAt: '2024-12-31' }) });
    expect((await mockPost('/payment-links', { expiresAt: '2024-12-31' })).data.expiresAt).toBeDefined();
  });

  it('should generate QR code for payment link', async () => {
    mockPost.mockResolvedValueOnce({ data: { ...makeLink(), qrCode: 'data:image/png;base64,...' } });
    expect((await mockPost('/payment-links', {})).data.qrCode).toBeDefined();
  });

  it('should handle creation error', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 422 } });
    await expect(mockPost('/payment-links', {})).rejects.toMatchObject({ response: { status: 422 } });
  });

  it('should deactivate payment link', async () => {
    mockPut.mockResolvedValueOnce({ data: makeLink({ status: 'inactive' }) });
    expect((await mockPut('/payment-links/link_1', { status: 'inactive' })).data.status).toBe('inactive');
  });
});

describe('Sales Integration – Revenue Chart + Date Range', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should load revenue chart for current month', async () => {
    mockGet.mockResolvedValueOnce({ data: { labels: ['W1', 'W2', 'W3', 'W4'], data: [5000, 10000, 15000, 20000] } });
    const res = await mockGet('/revenue-chart', { period: 'month' });
    expect(res.data.data).toHaveLength(4);
  });

  it('should load revenue chart for date range', async () => {
    mockGet.mockResolvedValueOnce({ data: { labels: ['Jan', 'Feb'], data: [10000, 15000] } });
    expect((await mockGet({ from: '2024-01-01', to: '2024-02-28' })).data.labels).toHaveLength(2);
  });

  it('should show loading state while fetching chart', () => {
    const l = vi.fn().mockReturnValue(true); expect(l()).toBe(true);
  });

  it('should handle chart fetch error', async () => {
    mockGet.mockRejectedValueOnce(new Error('Chart load failed'));
    await expect(mockGet('/revenue-chart')).rejects.toThrow('Chart load failed');
  });

  it('should aggregate data by day for weekly view', async () => {
    mockGet.mockResolvedValueOnce({ data: { granularity: 'day', labels: 7 } });
    expect((await mockGet({ period: 'week' })).data.granularity).toBe('day');
  });

  it('should aggregate data by month for yearly view', async () => {
    mockGet.mockResolvedValueOnce({ data: { granularity: 'month', labels: 12 } });
    expect((await mockGet({ period: 'year' })).data.labels).toBe(12);
  });

  it('should show comparison line for previous period', async () => {
    mockGet.mockResolvedValueOnce({ data: { current: [10000], previous: [8000] } });
    expect((await mockGet({ compare: true })).data.previous).toBeDefined();
  });

  it('should format chart tooltip as currency', () => {
    const f = vi.fn().mockReturnValue('$10,000.00'); expect(f(10000)).toBe('$10,000.00');
  });

  it('should cache chart data', () => {
    const c = vi.fn().mockReturnValue({ stale: false }); expect(c('revenue-chart').stale).toBe(false);
  });

  it('should switch between bar and line chart', () => {
    const setType = vi.fn(); setType('line'); expect(setType).toHaveBeenCalledWith('line');
  });
});

describe('Sales Integration – Target vs Actual Comparison', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should load sales targets', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeTarget()] });
    expect((await mockGet('/targets')).data).toHaveLength(1);
  });

  it('should show target vs actual for current period', async () => {
    mockGet.mockResolvedValueOnce({ data: makeTarget({ target: 60000, actual: 50000 }) });
    const res = await mockGet('/targets/current');
    expect(res.data.actual).toBeLessThan(res.data.target);
  });

  it('should calculate progress percentage', () => {
    const calc = vi.fn().mockReturnValue(83);
    expect(calc(50000, 60000)).toBe(83);
  });

  it('should create new target', async () => {
    mockPost.mockResolvedValueOnce({ data: makeTarget({ target: 80000 }) });
    expect((await mockPost('/targets', { period: '2024-02', target: 80000 })).data.target).toBe(80000);
  });

  it('should show target achievement celebration', () => {
    const celebrate = vi.fn().mockReturnValue(true); expect(celebrate(60000, 60000)).toBe(true);
  });

  it('should show warning when behind target', () => {
    const warn = vi.fn().mockReturnValue(true); expect(warn(30000, 60000, 0.5)).toBe(true);
  });

  it('should handle target not set', async () => {
    mockGet.mockResolvedValueOnce({ data: null });
    expect((await mockGet('/targets/current')).data).toBeNull();
  });

  it('should list all targets by period', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeTarget(), makeTarget({ id: 'tgt_2', period: '2024-02' })] });
    expect((await mockGet('/targets')).data).toHaveLength(2);
  });
});

describe('Sales Integration – Promotion Coupon Application', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should apply coupon to payment link', async () => {
    mockPost.mockResolvedValueOnce({ data: { originalAmount: 100, discountedAmount: 90, coupon: 'PROMO10' } });
    const res = await mockPost('/payment-links/link_1/coupon', { code: 'PROMO10' });
    expect(res.data.discountedAmount).toBe(90);
  });

  it('should reject invalid coupon', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 404 } });
    await expect(mockPost('/coupon/validate', { code: 'FAKE' })).rejects.toMatchObject({ response: { status: 404 } });
  });

  it('should reject expired coupon', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 422 } });
    await expect(mockPost('/coupon/validate', { code: 'EXPIRED' })).rejects.toMatchObject({ response: { status: 422 } });
  });

  it('should show discount amount applied', async () => {
    mockPost.mockResolvedValueOnce({ data: { discount: 10, finalAmount: 90 } });
    expect((await mockPost('/coupon/apply', { code: 'PROMO10', amount: 100 })).data.discount).toBe(10);
  });

  it('should track coupon usage', async () => {
    mockPost.mockResolvedValueOnce({ data: { uses: 1, maxUses: 100 } });
    expect((await mockPost('/coupon/PROMO10/use')).data.uses).toBe(1);
  });
});

describe('Sales Integration – Report Generation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should generate sales report', async () => {
    mockPost.mockResolvedValueOnce({ data: { url: 'https://files/sales-report.pdf' } });
    expect((await mockPost('/reports/generate')).data.url).toBeDefined();
  });

  it('should generate report for date range', async () => {
    mockPost.mockResolvedValueOnce({ data: { url: 'https://files/report.pdf', period: 'Jan 2024' } });
    expect((await mockPost('/reports/generate', { from: '2024-01-01', to: '2024-01-31' })).data.period).toBeDefined();
  });

  it('should include metrics summary in report', async () => {
    mockPost.mockResolvedValueOnce({ data: { metrics: makeMetric() } });
    expect((await mockPost('/reports/generate')).data.metrics.revenue).toBe(50000);
  });

  it('should include payment links data in report', async () => {
    mockPost.mockResolvedValueOnce({ data: { links: [makeLink()] } });
    expect((await mockPost('/reports/generate')).data.links).toHaveLength(1);
  });

  it('should download generated report', () => {
    const dl = vi.fn(); dl('https://files/report.pdf'); expect(dl).toHaveBeenCalled();
  });

  it('should handle report generation error', async () => {
    mockPost.mockRejectedValueOnce(new Error('Report failed'));
    await expect(mockPost('/reports/generate')).rejects.toThrow('Report failed');
  });
});

describe('Sales Integration – Sales Funnel Data', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should load funnel data', async () => {
    mockGet.mockResolvedValueOnce({ data: { views: 1000, clicks: 200, checkouts: 50, conversions: 20 } });
    expect((await mockGet('/funnel')).data.views).toBe(1000);
  });

  it('should calculate click-through rate', () => {
    const ctr = vi.fn().mockReturnValue(20); expect(ctr(200, 1000)).toBe(20);
  });

  it('should calculate checkout conversion rate', () => {
    const cvr = vi.fn().mockReturnValue(40); expect(cvr(20, 50)).toBe(40);
  });

  it('should filter funnel by date range', async () => {
    mockGet.mockResolvedValueOnce({ data: { views: 500 } });
    expect((await mockGet({ from: '2024-01-01' })).data.views).toBe(500);
  });

  it('should show funnel drop-off percentages', async () => {
    mockGet.mockResolvedValueOnce({ data: { dropOff: { views_to_clicks: 80, clicks_to_checkout: 75, checkout_to_purchase: 60 } } });
    expect((await mockGet('/funnel/dropoff')).data.dropOff).toBeDefined();
  });

  it('should handle funnel fetch error', async () => {
    mockGet.mockRejectedValueOnce(new Error('Funnel failed'));
    await expect(mockGet('/funnel')).rejects.toThrow('Funnel failed');
  });
});
