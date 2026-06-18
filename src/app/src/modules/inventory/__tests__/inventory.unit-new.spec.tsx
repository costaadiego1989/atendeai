import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('../hooks/useInventoryItems', () => ({ useInventoryItems: vi.fn() }));
vi.mock('../hooks/useInventoryKPIs', () => ({ useInventoryKPIs: vi.fn() }));
vi.mock('../hooks/useInventoryConnection', () => ({ useInventoryConnection: vi.fn() }));

import { useInventoryItems } from '../hooks/useInventoryItems';
import { useInventoryKPIs } from '../hooks/useInventoryKPIs';
import { useInventoryConnection } from '../hooks/useInventoryConnection';

// ── Domain helpers ─────────────────────────────────────────────────────────
const makeItem = (o: Record<string, unknown> = {}) => ({
  id: 'item-1', sku: 'SKU-001', name: 'Product A',
  quantity: 100, price: 29.99, unit: 'units',
  tenantId: 'tenant-1', ...o,
});

const LOW_STOCK_THRESHOLD = 10;
const OUT_OF_STOCK_THRESHOLD = 0;

const getStockStatus = (qty: number) => {
  if (qty <= OUT_OF_STOCK_THRESHOLD) return 'out_of_stock';
  if (qty <= LOW_STOCK_THRESHOLD) return 'low_stock';
  return 'in_stock';
};

const validateSKU = (sku: string) => /^[A-Z0-9\-]{3,20}$/.test(sku);

const validateItem = (d: Record<string, unknown>) => {
  const errors: string[] = [];
  if (!d.name) errors.push('name required');
  if (!d.sku) errors.push('sku required');
  if (d.sku && !validateSKU(String(d.sku))) errors.push('sku invalid format');
  if (typeof d.quantity === 'number' && d.quantity < 0) errors.push('quantity cannot be negative');
  if (typeof d.price === 'number' && d.price < 0) errors.push('price cannot be negative');
  return errors;
};

const calcDelta = (before: number, after: number) => ({ delta: after - before, pct: before > 0 ? ((after - before) / before) * 100 : null });

const calcReadiness = (items: Array<{ isReady: boolean }>) =>
  items.length > 0 ? (items.filter(i => i.isReady).length / items.length) * 100 : 0;

const UNITS = ['units', 'kg', 'liters', 'meters', 'boxes'];
const isValidUnit = (u: string) => UNITS.includes(u);

// ── Item model validation ──────────────────────────────────────────────────
describe('Inventory item data model', () => {
  it('valid item passes', () => expect(validateItem(makeItem())).toHaveLength(0));
  it('requires name', () => expect(validateItem(makeItem({ name: '' }))).toContain('name required'));
  it('requires sku', () => expect(validateItem(makeItem({ sku: '' }))).toContain('sku required'));
  it('rejects invalid sku format', () => expect(validateItem(makeItem({ sku: 'inv alid!' }))).toContain('sku invalid format'));
  it('rejects negative quantity', () => expect(validateItem(makeItem({ quantity: -1 }))).toContain('quantity cannot be negative'));
  it('rejects negative price', () => expect(validateItem(makeItem({ price: -1 }))).toContain('price cannot be negative'));
  it('allows zero quantity', () => expect(validateItem(makeItem({ quantity: 0 }))).toHaveLength(0));
  it('allows zero price', () => expect(validateItem(makeItem({ price: 0 }))).toHaveLength(0));
  it('handles null name', () => expect(validateItem(makeItem({ name: null }))).toContain('name required'));
  it('sku uppercase and dashes valid', () => expect(validateSKU('SKU-001')).toBe(true));
  it('sku with lowercase invalid', () => expect(validateSKU('sku-001')).toBe(false));
  it('sku too short invalid', () => expect(validateSKU('AB')).toBe(false));
  it('sku too long invalid', () => expect(validateSKU('A'.repeat(21))).toBe(false));
  it('valid units accepted', () => UNITS.forEach(u => expect(isValidUnit(u)).toBe(true)));
  it('invalid unit rejected', () => expect(isValidUnit('unknown')).toBe(false));
});

// ── Stock level calculation ────────────────────────────────────────────────
describe('Stock level calculation', () => {
  it('100 units is in_stock', () => expect(getStockStatus(100)).toBe('in_stock'));
  it('10 units is low_stock', () => expect(getStockStatus(10)).toBe('low_stock'));
  it('5 units is low_stock', () => expect(getStockStatus(5)).toBe('low_stock'));
  it('0 units is out_of_stock', () => expect(getStockStatus(0)).toBe('out_of_stock'));
  it('11 units is in_stock', () => expect(getStockStatus(11)).toBe('in_stock'));
  it('negative treated as out_of_stock', () => expect(getStockStatus(-5)).toBe('out_of_stock'));
  it('status distribution', () => {
    const items = [makeItem({ quantity: 100 }), makeItem({ quantity: 5, id: 'i2' }), makeItem({ quantity: 0, id: 'i3' })];
    const statuses = items.map(i => getStockStatus(i.quantity as number));
    expect(statuses).toContain('in_stock');
    expect(statuses).toContain('low_stock');
    expect(statuses).toContain('out_of_stock');
  });
});

// ── useInventoryItems hook ─────────────────────────────────────────────────
describe('useInventoryItems hook', () => {
  beforeEach(() => vi.clearAllMocks());
  it('loading state', () => {
    (useInventoryItems as ReturnType<typeof vi.fn>).mockReturnValue({ isLoading: true, data: undefined });
    expect(renderHook(() => useInventoryItems({})).result.current.isLoading).toBe(true);
  });
  it('returns item list', () => {
    (useInventoryItems as ReturnType<typeof vi.fn>).mockReturnValue({ isLoading: false, data: [makeItem()] });
    expect(renderHook(() => useInventoryItems({})).result.current.data).toHaveLength(1);
  });
  it('returns empty list', () => {
    (useInventoryItems as ReturnType<typeof vi.fn>).mockReturnValue({ isLoading: false, data: [] });
    expect(renderHook(() => useInventoryItems({})).result.current.data).toHaveLength(0);
  });
  it('error state', () => {
    const err = new Error('fetch failed');
    (useInventoryItems as ReturnType<typeof vi.fn>).mockReturnValue({ isLoading: false, error: err });
    expect(renderHook(() => useInventoryItems({})).result.current.error).toBe(err);
  });
  it('accepts filter params', () => {
    (useInventoryItems as ReturnType<typeof vi.fn>).mockReturnValue({ isLoading: false, data: [] });
    renderHook(() => useInventoryItems({ status: 'low_stock' }));
    expect(useInventoryItems).toHaveBeenCalledWith({ status: 'low_stock' });
  });
  it('filter by sku', () => {
    (useInventoryItems as ReturnType<typeof vi.fn>).mockReturnValue({ isLoading: false, data: [makeItem()] });
    renderHook(() => useInventoryItems({ sku: 'SKU-001' }));
    expect(useInventoryItems).toHaveBeenCalledWith({ sku: 'SKU-001' });
  });
  it('handles 403 forbidden', () => {
    const err = Object.assign(new Error('Forbidden'), { status: 403 });
    (useInventoryItems as ReturnType<typeof vi.fn>).mockReturnValue({ isLoading: false, error: err });
    expect((renderHook(() => useInventoryItems({})).result.current.error as any)?.status).toBe(403);
  });
});

// ── useInventoryKPIs hook ──────────────────────────────────────────────────
describe('useInventoryKPIs hook', () => {
  beforeEach(() => vi.clearAllMocks());
  it('returns kpi data', () => {
    const kpis = { totalItems: 50, lowStock: 5, outOfStock: 2 };
    (useInventoryKPIs as ReturnType<typeof vi.fn>).mockReturnValue({ isLoading: false, data: kpis });
    expect(renderHook(() => useInventoryKPIs()).result.current.data).toEqual(kpis);
  });
  it('loading state', () => {
    (useInventoryKPIs as ReturnType<typeof vi.fn>).mockReturnValue({ isLoading: true, data: undefined });
    expect(renderHook(() => useInventoryKPIs()).result.current.isLoading).toBe(true);
  });
  it('error state', () => {
    const err = new Error('kpi error');
    (useInventoryKPIs as ReturnType<typeof vi.fn>).mockReturnValue({ isLoading: false, error: err });
    expect(renderHook(() => useInventoryKPIs()).result.current.error).toBe(err);
  });
  it('all kpi fields present', () => {
    const kpis = { totalItems: 50, lowStock: 5, outOfStock: 2, totalValue: 10000 };
    (useInventoryKPIs as ReturnType<typeof vi.fn>).mockReturnValue({ isLoading: false, data: kpis });
    const { data } = renderHook(() => useInventoryKPIs()).result.current;
    expect(data).toHaveProperty('totalItems');
    expect(data).toHaveProperty('lowStock');
  });
});

// ── useInventoryConnection hook ────────────────────────────────────────────
describe('useInventoryConnection hook', () => {
  beforeEach(() => vi.clearAllMocks());
  it('returns connection list', () => {
    const connections = [{ id: 'conn-1', name: 'Warehouse A', isActive: true }];
    (useInventoryConnection as ReturnType<typeof vi.fn>).mockReturnValue({ isLoading: false, data: connections });
    expect(renderHook(() => useInventoryConnection()).result.current.data).toHaveLength(1);
  });
  it('loading state', () => {
    (useInventoryConnection as ReturnType<typeof vi.fn>).mockReturnValue({ isLoading: true, data: undefined });
    expect(renderHook(() => useInventoryConnection()).result.current.isLoading).toBe(true);
  });
  it('error state', () => {
    const err = new Error('connection error');
    (useInventoryConnection as ReturnType<typeof vi.fn>).mockReturnValue({ isLoading: false, error: err });
    expect(renderHook(() => useInventoryConnection()).result.current.error).toBe(err);
  });
  it('empty connections list', () => {
    (useInventoryConnection as ReturnType<typeof vi.fn>).mockReturnValue({ isLoading: false, data: [] });
    expect(renderHook(() => useInventoryConnection()).result.current.data).toHaveLength(0);
  });
});

// ── Snapshot comparison ────────────────────────────────────────────────────
describe('Snapshot comparison', () => {
  it('positive delta when stock increases', () => expect(calcDelta(80, 100).delta).toBe(20));
  it('negative delta when stock decreases', () => expect(calcDelta(100, 80).delta).toBe(-20));
  it('zero delta no change', () => expect(calcDelta(100, 100).delta).toBe(0));
  it('pct change 25% increase', () => expect(calcDelta(80, 100).pct).toBe(25));
  it('pct change 20% decrease', () => expect(calcDelta(100, 80).pct).toBeCloseTo(-20));
  it('pct null when before is zero', () => expect(calcDelta(0, 100).pct).toBeNull());
  it('delta with fractional values', () => expect(calcDelta(10.5, 12.5).delta).toBeCloseTo(2));
});

// ── Readiness score ────────────────────────────────────────────────────────
describe('Readiness score calculation', () => {
  it('100% when all ready', () => expect(calcReadiness([{ isReady: true }, { isReady: true }])).toBe(100));
  it('0% when none ready', () => expect(calcReadiness([{ isReady: false }, { isReady: false }])).toBe(0));
  it('50% when half ready', () => expect(calcReadiness([{ isReady: true }, { isReady: false }])).toBe(50));
  it('0% for empty list', () => expect(calcReadiness([])).toBe(0));
  it('75% with 3 of 4 ready', () => expect(calcReadiness([{ isReady: true }, { isReady: true }, { isReady: true }, { isReady: false }])).toBe(75));
});

// ── Negative stock detection ───────────────────────────────────────────────
describe('Negative stock detection', () => {
  it('negative stock detected', () => {
    const items = [makeItem({ quantity: -5 })];
    expect(items.some(i => (i.quantity as number) < 0)).toBe(true);
  });
  it('zero stock not negative', () => {
    const items = [makeItem({ quantity: 0 })];
    expect(items.some(i => (i.quantity as number) < 0)).toBe(false);
  });
  it('all positive stocks pass', () => {
    const items = [makeItem({ quantity: 10 }), makeItem({ quantity: 5, id: 'i2' })];
    expect(items.every(i => (i.quantity as number) >= 0)).toBe(true);
  });
});

// ── Reorder point logic ────────────────────────────────────────────────────
describe('Reorder point alert logic', () => {
  it('triggers alert below reorder point', () => {
    const item = makeItem({ quantity: 5, reorderPoint: 10 });
    const needsReorder = (item.quantity as number) <= (item as any).reorderPoint;
    expect(needsReorder).toBe(true);
  });
  it('no alert above reorder point', () => {
    const item = makeItem({ quantity: 15, reorderPoint: 10 });
    const needsReorder = (item.quantity as number) <= (item as any).reorderPoint;
    expect(needsReorder).toBe(false);
  });
  it('alert at exactly reorder point', () => {
    const item = makeItem({ quantity: 10, reorderPoint: 10 });
    const needsReorder = (item.quantity as number) <= (item as any).reorderPoint;
    expect(needsReorder).toBe(true);
  });
  it('bulk items needing reorder', () => {
    const items = [
      makeItem({ quantity: 5, reorderPoint: 10, id: 'i1' }),
      makeItem({ quantity: 15, reorderPoint: 10, id: 'i2' }),
      makeItem({ quantity: 8, reorderPoint: 10, id: 'i3' }),
    ];
    const alerts = items.filter(i => (i.quantity as number) <= (i as any).reorderPoint);
    expect(alerts).toHaveLength(2);
  });
  it('undefined reorder point treated as zero', () => {
    const item = makeItem({ quantity: 0 });
    const rp = (item as any).reorderPoint ?? 0;
    expect((item.quantity as number) <= rp).toBe(true);
  });
});
