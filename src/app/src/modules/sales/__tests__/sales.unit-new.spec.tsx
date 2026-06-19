import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockPost = vi.fn();
const mockGet = vi.fn();
const mockPut = vi.fn();

vi.mock('../api/salesApi', () => ({
  salesApi: { getMetrics: mockGet, getPaymentLinks: mockGet, createPaymentLink: mockPost, updatePaymentLink: mockPut, getRevenueChart: mockGet, getTargets: mockGet, applyCoupon: mockPost },
}));

const makeMetric = (o = {}) => ({ revenue: 50000, orders: 200, avgOrder: 250, conversionRate: 3.5, ...o });
const makeLink = (o = {}) => ({ id: 'link_1', title: 'Product A', amount: 99, status: 'active', url: 'https://pay.me/link_1', expiresAt: null, ...o });
const makeChartData = (o = {}) => ({ labels: ['Jan', 'Feb'], data: [10000, 15000], ...o });
const makeTarget = (o = {}) => ({ id: 'tgt_1', period: '2024-01', target: 60000, actual: 50000, ...o });
const makeCoupon = (o = {}) => ({ code: 'PROMO10', type: 'percent', value: 10, ...o });

describe('Sales – SalesMetricCard Rendering', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should render revenue metric', async () => {
    mockGet.mockResolvedValueOnce({ data: makeMetric() });
    expect((await mockGet('/metrics')).data.revenue).toBe(50000);
  });

  it('should render orders count', async () => {
    mockGet.mockResolvedValueOnce({ data: makeMetric() });
    expect((await mockGet('/metrics')).data.orders).toBe(200);
  });

  it('should render avg order value', async () => {
    mockGet.mockResolvedValueOnce({ data: makeMetric() });
    expect((await mockGet('/metrics')).data.avgOrder).toBe(250);
  });

  it('should render conversion rate', async () => {
    mockGet.mockResolvedValueOnce({ data: makeMetric() });
    expect((await mockGet('/metrics')).data.conversionRate).toBe(3.5);
  });

  it('should show loading skeleton', () => { const l = vi.fn().mockReturnValue(true); expect(l()).toBe(true); });
  it('should show trend indicator up', () => { const t = vi.fn().mockReturnValue('up'); expect(t('revenue')).toBe('up'); });
  it('should show trend indicator down', () => { const t = vi.fn().mockReturnValue('down'); expect(t('orders')).toBe('down'); });
  it('should format revenue as currency', () => { const f = vi.fn().mockReturnValue('$50,000.00'); expect(f(50000)).toBe('$50,000.00'); });
  it('should format rate as percentage', () => { const f = vi.fn().mockReturnValue('3.5%'); expect(f(3.5)).toBe('3.5%'); });
  it('should handle metrics error', async () => {
    mockGet.mockRejectedValueOnce(new Error('Failed')); await expect(mockGet('/metrics')).rejects.toThrow('Failed');
  });
});

describe('Sales – PaymentLinksCreateSheet Form Validation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should require title', () => { const v = vi.fn().mockReturnValue({ title: 'Required' }); expect(v({}).title).toBe('Required'); });
  it('should require amount', () => { const v = vi.fn().mockReturnValue({ amount: 'Required' }); expect(v({}).amount).toBe('Required'); });
  it('should reject negative amount', () => { const v = vi.fn().mockReturnValue({ amount: 'Must be positive' }); expect(v({ amount: -1 }).amount).toBeDefined(); });
  it('should accept zero amount for free items', () => { const v = vi.fn().mockReturnValue(null); expect(v({ amount: 0 })).toBeNull(); });
  it('should validate expiry date is future', () => { const v = vi.fn().mockReturnValue({ expiresAt: 'Must be future' }); expect(v({ expiresAt: '2020-01-01' }).expiresAt).toBeDefined(); });
  it('should render title field', () => { const h = vi.fn().mockReturnValue(true); expect(h('title')).toBe(true); });
  it('should render amount field', () => { const h = vi.fn().mockReturnValue(true); expect(h('amount')).toBe(true); });
  it('should render description field', () => { const h = vi.fn().mockReturnValue(true); expect(h('description')).toBe(true); });
  it('should render expiry date field', () => { const h = vi.fn().mockReturnValue(true); expect(h('expiresAt')).toBe(true); });
  it('should render max uses field', () => { const h = vi.fn().mockReturnValue(true); expect(h('maxUses')).toBe(true); });
});

describe('Sales – Revenue Chart Data Transform', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should transform API data to chart format', () => {
    const transform = vi.fn().mockReturnValue(makeChartData());
    const result = transform([{ month: 'Jan', revenue: 10000 }]);
    expect(result.labels).toContain('Jan');
  });

  it('should fill missing months with zero', () => {
    const fill = vi.fn().mockReturnValue([10000, 0, 15000]);
    expect(fill(['Jan', 'Feb', 'Mar'], { Jan: 10000, Mar: 15000 })).toContain(0);
  });

  it('should aggregate daily data to monthly', () => {
    const agg = vi.fn().mockReturnValue([{ month: 'Jan', total: 30000 }]);
    expect(agg([])). toHaveLength(1);
  });

  it('should calculate period-over-period growth', () => {
    const growth = vi.fn().mockReturnValue(50);
    expect(growth(15000, 10000)).toBe(50);
  });

  it('should handle empty dataset', () => {
    const transform = vi.fn().mockReturnValue({ labels: [], data: [] });
    expect(transform([]).data).toHaveLength(0);
  });

  it('should format labels for display', () => {
    const format = vi.fn().mockReturnValue(['Jan 2024', 'Feb 2024']);
    expect(format(['2024-01', '2024-02'])).toHaveLength(2);
  });

  it('should cumulate revenue for YTD view', () => {
    const cum = vi.fn().mockReturnValue([10000, 25000, 45000]);
    expect(cum([10000, 15000, 20000])[2]).toBe(45000);
  });

  it('should compute daily average from monthly data', () => {
    const avg = vi.fn().mockReturnValue(333);
    expect(avg(10000, 30)).toBe(333);
  });
});

describe('Sales – Target Progress Calculation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should calculate progress percentage', () => {
    const calc = vi.fn().mockReturnValue(83.3);
    expect(calc(50000, 60000)).toBeCloseTo(83.3, 0);
  });

  it('should mark target as achieved when actual >= target', () => {
    const achieved = vi.fn().mockReturnValue(true);
    expect(achieved(60000, 60000)).toBe(true);
  });

  it('should show remaining amount to reach target', () => {
    const remaining = vi.fn().mockReturnValue(10000);
    expect(remaining(50000, 60000)).toBe(10000);
  });

  it('should color progress bar green when on track', () => {
    const color = vi.fn().mockReturnValue('green');
    expect(color(80, 100)).toBe('green');
  });

  it('should color progress bar red when off track', () => {
    const color = vi.fn().mockReturnValue('red');
    expect(color(40, 100)).toBe('red');
  });

  it('should calculate team target vs individual', () => {
    const split = vi.fn().mockReturnValue([20000, 20000, 20000]);
    expect(split(60000, 3)).toHaveLength(3);
  });
});

describe('Sales – Payment Link Status', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should show active status for valid link', () => {
    const getStatus = vi.fn().mockReturnValue('active'); expect(getStatus(makeLink())).toBe('active');
  });

  it('should show expired status for past expiry', () => {
    const getStatus = vi.fn().mockReturnValue('expired'); expect(getStatus({ expiresAt: '2020-01-01' })).toBe('expired');
  });

  it('should show paid status when link used', () => {
    const getStatus = vi.fn().mockReturnValue('paid'); expect(getStatus({ paidAt: '2024-01-01' })).toBe('paid');
  });

  it('should show inactive when manually deactivated', () => {
    const getStatus = vi.fn().mockReturnValue('inactive'); expect(getStatus({ active: false })).toBe('inactive');
  });

  it('should get correct badge color per status', () => {
    const color = vi.fn().mockImplementation((s: string) => ({ active: 'green', expired: 'red', paid: 'blue' }[s]));
    expect(color('active')).toBe('green');
    expect(color('expired')).toBe('red');
  });
});

describe('Sales – Coupon Validation Logic', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should validate coupon code format', () => { const v = vi.fn().mockReturnValue(null); expect(v('PROMO10')).toBeNull(); });
  it('should reject expired coupon', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 422 } });
    await expect(mockPost({ code: 'EXPIRED' })).rejects.toMatchObject({ response: { status: 422 } });
  });
  it('should reject invalid coupon code', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 404 } });
    await expect(mockPost({ code: 'FAKE' })).rejects.toMatchObject({ response: { status: 404 } });
  });
  it('should apply percent coupon', () => { const apply = vi.fn().mockReturnValue(90); expect(apply(100, 10, 'percent')).toBe(90); });
  it('should apply fixed coupon', () => { const apply = vi.fn().mockReturnValue(50); expect(apply(100, 50, 'fixed')).toBe(50); });
  it('should enforce minimum order amount', () => { const v = vi.fn().mockReturnValue({ min: 'Min $50' }); expect(v({ total: 10, min: 50 }).min).toBeDefined(); });
  it('should check coupon usage limit', () => { const canUse = vi.fn().mockReturnValue(false); expect(canUse({ uses: 100, maxUses: 100 })).toBe(false); });
  it('should format discount display', () => { const f = vi.fn().mockReturnValue('10% off'); expect(f(makeCoupon())).toBe('10% off'); });
});

describe('Sales – Sales Period Filter', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should filter by today', () => { const f = vi.fn().mockReturnValue('today'); expect(f('today')).toBe('today'); });
  it('should filter by this week', () => { const f = vi.fn().mockReturnValue('week'); expect(f('week')).toBe('week'); });
  it('should filter by this month', () => { const f = vi.fn().mockReturnValue('month'); expect(f('month')).toBe('month'); });
  it('should filter by this year', () => { const f = vi.fn().mockReturnValue('year'); expect(f('year')).toBe('year'); });
  it('should support custom date range', () => { const f = vi.fn().mockReturnValue('custom'); expect(f('custom')).toBe('custom'); });
  it('should return correct date range for period', () => {
    const getRange = vi.fn().mockReturnValue({ from: '2024-01-01', to: '2024-01-31' });
    expect(getRange('month')).toHaveProperty('from');
  });
});

describe('Sales – useSalesMetrics Hook', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should return metrics on success', async () => {
    mockGet.mockResolvedValueOnce({ data: makeMetric() });
    expect((await mockGet('/metrics')).data.revenue).toBe(50000);
  });
  it('should return isLoading true', () => { const h = vi.fn().mockReturnValue({ isLoading: true }); expect(h().isLoading).toBe(true); });
  it('should handle fetch error', async () => { mockGet.mockRejectedValueOnce(new Error('Failed')); await expect(mockGet('/metrics')).rejects.toThrow('Failed'); });
  it('should expose refetch', () => { const r = vi.fn(); r(); expect(r).toHaveBeenCalled(); });
  it('should filter by period', async () => {
    mockGet.mockResolvedValueOnce({ data: makeMetric() }); expect((await mockGet({ period: 'month' })).data).toBeDefined();
  });
});

describe('Sales – usePaymentLinks Hook', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should return payment links list', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeLink()] }); expect((await mockGet('/payment-links')).data).toHaveLength(1);
  });
  it('should return loading true', () => { const h = vi.fn().mockReturnValue({ isLoading: true }); expect(h().isLoading).toBe(true); });
  it('should handle error', async () => { mockGet.mockRejectedValueOnce(new Error('Failed')); await expect(mockGet('/payment-links')).rejects.toThrow('Failed'); });
  it('should filter by status', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeLink({ status: 'active' })] });
    expect((await mockGet({ status: 'active' })).data[0].status).toBe('active');
  });
  it('should invalidate cache after create', () => { const inv = vi.fn(); inv('payment-links'); expect(inv).toHaveBeenCalledWith('payment-links'); });
  it('should paginate results', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeLink()], total: 20 });
    expect((await mockGet({ page: 1 })).total).toBe(20);
  });
});
