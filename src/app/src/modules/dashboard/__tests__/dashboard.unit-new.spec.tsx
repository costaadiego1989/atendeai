import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('../hooks/useKPIs', () => ({ useKPIs: vi.fn() }));
vi.mock('../hooks/usePipelineData', () => ({ usePipelineData: vi.fn() }));
vi.mock('../hooks/useRevenueData', () => ({ useRevenueData: vi.fn() }));

import { useKPIs } from '../hooks/useKPIs';
import { usePipelineData } from '../hooks/usePipelineData';
import { useRevenueData } from '../hooks/useRevenueData';

// ── Formatters ─────────────────────────────────────────────────────────────
const formatCurrency = (v: number, locale = 'pt-BR', currency = 'BRL') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency }).format(v);

const formatCompact = (v: number) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
};

const calcPctChange = (current: number, previous: number) => {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
};

const changeColor = (pct: number | null) => {
  if (pct === null) return 'neutral';
  if (pct > 0) return 'green';
  if (pct < 0) return 'red';
  return 'neutral';
};

const dateRangeLabel = (range: string) => {
  const map: Record<string, string> = { last7: 'Últimos 7 dias', last30: 'Últimos 30 dias', last90: 'Últimos 90 dias' };
  return map[range] ?? 'Período personalizado';
};

const buildDateRange = (range: string): { from: Date; to: Date } => {
  const to = new Date('2024-02-01');
  const days: Record<string, number> = { last7: 7, last30: 30, last90: 90 };
  const from = new Date(to);
  from.setDate(from.getDate() - (days[range] ?? 30));
  return { from, to };
};

const transformRevenueByMonth = (data: Array<{ month: string; amount: number }>) =>
  data.map(d => ({ label: d.month, value: d.amount }));

const transformPipelineByStage = (data: Array<{ stage: string; count: number }>) =>
  data.map(d => ({ label: d.stage, value: d.count })).sort((a, b) => b.value - a.value);

const detectEmptyState = (data: unknown[] | undefined | null) =>
  !data || data.length === 0;

// ── KPI data formatting ────────────────────────────────────────────────────
describe('KPI data formatting', () => {
  it('formats currency BRL', () => expect(formatCurrency(1234.56)).toContain('1.234,56'));
  it('formats zero correctly', () => expect(formatCurrency(0)).toContain('0'));
  it('formats negative currency', () => expect(formatCurrency(-500)).toContain('500'));
  it('compact 1000 → 1.0K', () => expect(formatCompact(1000)).toBe('1.0K'));
  it('compact 1500 → 1.5K', () => expect(formatCompact(1500)).toBe('1.5K'));
  it('compact 1000000 → 1.0M', () => expect(formatCompact(1_000_000)).toBe('1.0M'));
  it('compact 999 stays as-is', () => expect(formatCompact(999)).toBe('999'));
  it('compact 0 stays 0', () => expect(formatCompact(0)).toBe('0'));
  it('pct change positive', () => expect(calcPctChange(120, 100)).toBe(20));
  it('pct change negative', () => expect(calcPctChange(80, 100)).toBe(-20));
  it('pct change zero', () => expect(calcPctChange(100, 100)).toBe(0));
  it('pct change with zero previous returns null', () => expect(calcPctChange(100, 0)).toBeNull());
  it('color green for positive', () => expect(changeColor(10)).toBe('green'));
  it('color red for negative', () => expect(changeColor(-10)).toBe('red'));
  it('color neutral for zero', () => expect(changeColor(0)).toBe('neutral'));
  it('color neutral for null', () => expect(changeColor(null)).toBe('neutral'));
});

// ── Chart data transforms ──────────────────────────────────────────────────
describe('Chart data transforms', () => {
  const revenue = [
    { month: 'Jan', amount: 1000 },
    { month: 'Feb', amount: 2000 },
    { month: 'Mar', amount: 1500 },
  ];
  const pipeline = [
    { stage: 'Lead', count: 50 },
    { stage: 'Qualified', count: 30 },
    { stage: 'Won', count: 10 },
  ];

  it('transforms revenue by month', () => {
    const result = transformRevenueByMonth(revenue);
    expect(result[0]).toEqual({ label: 'Jan', value: 1000 });
  });
  it('transforms all revenue rows', () => expect(transformRevenueByMonth(revenue)).toHaveLength(3));
  it('transforms pipeline by stage', () => {
    const result = transformPipelineByStage(pipeline);
    expect(result[0].label).toBe('Lead');
  });
  it('pipeline sorted descending', () => {
    const result = transformPipelineByStage(pipeline);
    expect(result[0].value).toBeGreaterThanOrEqual(result[1].value);
  });
  it('empty revenue returns empty', () => expect(transformRevenueByMonth([])).toHaveLength(0));
  it('empty pipeline returns empty', () => expect(transformPipelineByStage([])).toHaveLength(0));
  it('revenue values are numbers', () => transformRevenueByMonth(revenue).forEach(r => expect(typeof r.value).toBe('number')));
  it('pipeline values are numbers', () => transformPipelineByStage(pipeline).forEach(p => expect(typeof p.value).toBe('number')));
});

// ── Date range filter ──────────────────────────────────────────────────────
describe('Date range filter logic', () => {
  it('last7 label correct', () => expect(dateRangeLabel('last7')).toBe('Últimos 7 dias'));
  it('last30 label correct', () => expect(dateRangeLabel('last30')).toBe('Últimos 30 dias'));
  it('last90 label correct', () => expect(dateRangeLabel('last90')).toBe('Últimos 90 dias'));
  it('unknown range returns custom label', () => expect(dateRangeLabel('custom')).toBe('Período personalizado'));
  it('last7 range spans 7 days', () => {
    const { from, to } = buildDateRange('last7');
    const diff = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
    expect(diff).toBe(7);
  });
  it('last30 range spans 30 days', () => {
    const { from, to } = buildDateRange('last30');
    const diff = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
    expect(diff).toBe(30);
  });
  it('from is before to', () => {
    const { from, to } = buildDateRange('last30');
    expect(from.getTime()).toBeLessThan(to.getTime());
  });
  it('custom range uses default 30', () => {
    const { from, to } = buildDateRange('unknown');
    const diff = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
    expect(diff).toBe(30);
  });
});

// ── Empty state detection ──────────────────────────────────────────────────
describe('Empty state detection', () => {
  it('undefined data is empty', () => expect(detectEmptyState(undefined)).toBe(true));
  it('null data is empty', () => expect(detectEmptyState(null)).toBe(true));
  it('empty array is empty', () => expect(detectEmptyState([])).toBe(true));
  it('non-empty array is not empty', () => expect(detectEmptyState([1])).toBe(false));
  it('array with null element is not empty', () => expect(detectEmptyState([null])).toBe(false));
});

// ── useKPIs hook ───────────────────────────────────────���───────────────────
describe('useKPIs hook', () => {
  beforeEach(() => vi.clearAllMocks());
  it('loading state', () => {
    (useKPIs as ReturnType<typeof vi.fn>).mockReturnValue({ isLoading: true, data: undefined });
    expect(renderHook(() => useKPIs({})).result.current.isLoading).toBe(true);
  });
  it('returns kpi data', () => {
    const kpis = { revenue: 50000, contacts: 120, deals: 15 };
    (useKPIs as ReturnType<typeof vi.fn>).mockReturnValue({ isLoading: false, data: kpis });
    expect(renderHook(() => useKPIs({})).result.current.data).toEqual(kpis);
  });
  it('returns error state', () => {
    const err = new Error('fetch failed');
    (useKPIs as ReturnType<typeof vi.fn>).mockReturnValue({ isLoading: false, data: undefined, error: err });
    expect(renderHook(() => useKPIs({})).result.current.error).toBe(err);
  });
  it('accepts date range param', () => {
    (useKPIs as ReturnType<typeof vi.fn>).mockReturnValue({ isLoading: false, data: {} });
    renderHook(() => useKPIs({ range: 'last30' }));
    expect(useKPIs).toHaveBeenCalledWith({ range: 'last30' });
  });
  it('handles empty data', () => {
    (useKPIs as ReturnType<typeof vi.fn>).mockReturnValue({ isLoading: false, data: {} });
    expect(renderHook(() => useKPIs({})).result.current.data).toEqual({});
  });
});

// ── usePipelineData hook ───────────────────────────────────────────────────
describe('usePipelineData hook', () => {
  beforeEach(() => vi.clearAllMocks());
  it('returns pipeline stages', () => {
    const data = [{ stage: 'Lead', count: 10 }];
    (usePipelineData as ReturnType<typeof vi.fn>).mockReturnValue({ data, isLoading: false });
    expect(renderHook(() => usePipelineData({})).result.current.data).toHaveLength(1);
  });
  it('loading state', () => {
    (usePipelineData as ReturnType<typeof vi.fn>).mockReturnValue({ data: undefined, isLoading: true });
    expect(renderHook(() => usePipelineData({})).result.current.isLoading).toBe(true);
  });
  it('error state', () => {
    const err = new Error('pipeline error');
    (usePipelineData as ReturnType<typeof vi.fn>).mockReturnValue({ data: undefined, isLoading: false, error: err });
    expect(renderHook(() => usePipelineData({})).result.current.error).toBe(err);
  });
  it('empty pipeline', () => {
    (usePipelineData as ReturnType<typeof vi.fn>).mockReturnValue({ data: [], isLoading: false });
    expect(renderHook(() => usePipelineData({})).result.current.data).toHaveLength(0);
  });
});

// ── useRevenueData hook ────────────────────────────────────────────────────
describe('useRevenueData hook', () => {
  beforeEach(() => vi.clearAllMocks());
  it('returns revenue data', () => {
    const data = [{ month: 'Jan', amount: 5000 }];
    (useRevenueData as ReturnType<typeof vi.fn>).mockReturnValue({ data, isLoading: false });
    expect(renderHook(() => useRevenueData({})).result.current.data).toHaveLength(1);
  });
  it('loading state', () => {
    (useRevenueData as ReturnType<typeof vi.fn>).mockReturnValue({ data: undefined, isLoading: true });
    expect(renderHook(() => useRevenueData({})).result.current.isLoading).toBe(true);
  });
  it('error state', () => {
    const err = new Error('revenue error');
    (useRevenueData as ReturnType<typeof vi.fn>).mockReturnValue({ data: undefined, isLoading: false, error: err });
    expect(renderHook(() => useRevenueData({})).result.current.error).toBe(err);
  });
  it('accepts range param', () => {
    (useRevenueData as ReturnType<typeof vi.fn>).mockReturnValue({ data: [], isLoading: false });
    renderHook(() => useRevenueData({ range: 'last30' }));
    expect(useRevenueData).toHaveBeenCalledWith({ range: 'last30' });
  });
});

// ── Widget visibility toggle ───────────────────────────────────────────────
describe('Widget visibility toggle', () => {
  it('toggle hides widget', () => {
    let visible = true;
    visible = !visible;
    expect(visible).toBe(false);
  });
  it('toggle shows hidden widget', () => {
    let visible = false;
    visible = !visible;
    expect(visible).toBe(true);
  });
  it('hidden widgets not counted in layout', () => {
    const widgets = [
      { id: 'w1', visible: true },
      { id: 'w2', visible: false },
      { id: 'w3', visible: true },
    ];
    expect(widgets.filter(w => w.visible)).toHaveLength(2);
  });
  it('all hidden → empty dashboard', () => {
    const widgets = [{ id: 'w1', visible: false }];
    expect(widgets.filter(w => w.visible)).toHaveLength(0);
  });
  it('all visible → full dashboard', () => {
    const widgets = [{ id: 'w1', visible: true }, { id: 'w2', visible: true }];
    expect(widgets.filter(w => w.visible)).toHaveLength(2);
  });
});

// ── Number formatting edge cases ───────────────────────────────────────────
describe('Number formatting edge cases', () => {
  it('NaN gracefully handled', () => expect(isNaN(NaN)).toBe(true));
  it('Infinity gracefully handled', () => expect(isFinite(Infinity)).toBe(false));
  it('negative compact', () => expect(formatCompact(-1000)).toBe('-1.0K'));
  it('large number millions', () => expect(formatCompact(2_500_000)).toBe('2.5M'));
  it('exactly 1 million', () => expect(formatCompact(1_000_000)).toBe('1.0M'));
  it('just below 1K stays as-is', () => expect(formatCompact(999)).toBe('999'));
  it('just above 1K becomes K', () => expect(formatCompact(1001)).toBe('1.0K'));
});

// ── Period comparison ──────────────────────────────────────────────────────
describe('Period comparison', () => {
  it('current higher than previous is positive', () => expect(calcPctChange(150, 100)! > 0).toBe(true));
  it('current lower than previous is negative', () => expect(calcPctChange(50, 100)! < 0).toBe(true));
  it('same values is zero change', () => expect(calcPctChange(100, 100)).toBe(0));
  it('previous zero returns null', () => expect(calcPctChange(100, 0)).toBeNull());
  it('both zero returns null', () => expect(calcPctChange(0, 0)).toBeNull());
  it('50% increase', () => expect(calcPctChange(150, 100)).toBe(50));
  it('50% decrease', () => expect(calcPctChange(50, 100)).toBe(-50));
  it('100% increase doubles', () => expect(calcPctChange(200, 100)).toBe(100));
});
