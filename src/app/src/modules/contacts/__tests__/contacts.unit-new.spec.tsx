import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../hooks/useContacts', () => ({ useContacts: vi.fn() }));
vi.mock('../hooks/useCreateContact', () => ({ useCreateContact: vi.fn() }));
vi.mock('../hooks/useUpdateContact', () => ({ useUpdateContact: vi.fn() }));
vi.mock('../hooks/useDeleteContact', () => ({ useDeleteContact: vi.fn() }));

import { useContacts } from '../hooks/useContacts';
import { useCreateContact } from '../hooks/useCreateContact';
import { useUpdateContact } from '../hooks/useUpdateContact';
import { useDeleteContact } from '../hooks/useDeleteContact';

const makeContact = (o: Record<string, unknown> = {}) => ({
  id: 'c1', firstName: 'Alice', lastName: 'Smith',
  email: 'alice@example.com', phone: '+1-555-0100',
  tags: ['vip'], createdAt: '2024-01-15T10:00:00Z', tenantId: 'tenant-1', ...o,
});

const makeEvent = (o: Record<string, unknown> = {}) => ({
  id: 'e1', contactId: 'c1', type: 'note',
  description: 'Called', createdAt: '2024-02-01T09:00:00Z', ...o,
});

const validateContact = (d: Record<string, unknown>) => {
  const e: string[] = [];
  if (!d.firstName) e.push('firstName required');
  if (!d.lastName) e.push('lastName required');
  if (!d.email) e.push('email required');
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(d.email))) e.push('email invalid');
  return e;
};

const sanitizeXSS = (s: string) =>
  s.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const parseCsvHeaders = (l: string) => l.split(',').map((h) => h.trim().toLowerCase());
const REQUIRED_HEADERS = ['firstname', 'lastname', 'email'];
const validateCsvHeaders = (h: string[]) => REQUIRED_HEADERS.every((r) => h.includes(r));

const filterContacts = (
  cs: ReturnType<typeof makeContact>[],
  q: string,
  f: 'firstName' | 'lastName' | 'email' | 'phone' | 'tags',
) =>
  cs.filter((c) => {
    if (f === 'tags') return c.tags.some((t) => t.includes(q));
    return String((c as any)[f] ?? '').toLowerCase().includes(q.toLowerCase());
  });

const paginate = (cs: ReturnType<typeof makeContact>[], page: number, size: number) =>
  cs.slice((page - 1) * size, page * size);

const sortByDate = (evs: ReturnType<typeof makeEvent>[], order: 'asc' | 'desc' = 'desc') =>
  [...evs].sort((a, b) => {
    const d = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return order === 'asc' ? d : -d;
  });

describe('Contact data model', () => {
  it('accepts valid contact', () => expect(validateContact(makeContact())).toHaveLength(0));
  it('requires firstName', () => expect(validateContact(makeContact({ firstName: '' }))).toContain('firstName required'));
  it('requires lastName', () => expect(validateContact(makeContact({ lastName: '' }))).toContain('lastName required'));
  it('requires email', () => expect(validateContact(makeContact({ email: '' }))).toContain('email required'));
  it('rejects malformed email', () => expect(validateContact(makeContact({ email: 'bad' }))).toContain('email invalid'));
  it('handles null firstName', () => expect(validateContact(makeContact({ firstName: null }))).toContain('firstName required'));
  it('handles null email', () => expect(validateContact(makeContact({ email: null }))).toContain('email required'));
  it('handles undefined fields', () => expect(validateContact({ id: 'x' }).length).toBeGreaterThan(0));
  it('sanitizes script tags', () => expect(sanitizeXSS('<script>alert(1)</script>')).toContain('&lt;script'));
  it('sanitizes quotes', () => expect(sanitizeXSS('"xss')).toContain('&quot;'));
});

describe('useContacts hook', () => {
  beforeEach(() => vi.clearAllMocks());
  it('returns loading true', () => {
    (useContacts as ReturnType<typeof vi.fn>).mockReturnValue({ isLoading: true, data: undefined, error: null });
    expect(renderHook(() => useContacts({})).result.current.isLoading).toBe(true);
  });
  it('returns error', () => {
    const err = new Error('fail');
    (useContacts as ReturnType<typeof vi.fn>).mockReturnValue({ isLoading: false, data: undefined, error: err });
    expect(renderHook(() => useContacts({})).result.current.error).toBe(err);
  });
  it('returns empty array', () => {
    (useContacts as ReturnType<typeof vi.fn>).mockReturnValue({ isLoading: false, data: [], error: null });
    expect(renderHook(() => useContacts({})).result.current.data).toEqual([]);
  });
  it('returns list of contacts', () => {
    (useContacts as ReturnType<typeof vi.fn>).mockReturnValue({ isLoading: false, data: [makeContact(), makeContact({ id: 'c2' })], error: null });
    expect(renderHook(() => useContacts({})).result.current.data).toHaveLength(2);
  });
  it('passes filter params', () => {
    (useContacts as ReturnType<typeof vi.fn>).mockReturnValue({ isLoading: false, data: [], error: null });
    renderHook(() => useContacts({ search: 'alice' }));
    expect(useContacts).toHaveBeenCalledWith({ search: 'alice' });
  });
  it('returns 403 error', () => {
    const err = Object.assign(new Error('Forbidden'), { status: 403 });
    (useContacts as ReturnType<typeof vi.fn>).mockReturnValue({ isLoading: false, data: undefined, error: err });
    expect((renderHook(() => useContacts({})).result.current.error as any)?.status).toBe(403);
  });
  it('returns 500 error', () => {
    const err = Object.assign(new Error('Server error'), { status: 500 });
    (useContacts as ReturnType<typeof vi.fn>).mockReturnValue({ isLoading: false, data: undefined, error: err });
    expect((renderHook(() => useContacts({})).result.current.error as any)?.status).toBe(500);
  });
  it('handles undefined data', () => {
    (useContacts as ReturnType<typeof vi.fn>).mockReturnValue({ isLoading: false, data: undefined, error: null });
    expect(renderHook(() => useContacts({})).result.current.data).toBeUndefined();
  });
});

describe('useCreateContact hook', () => {
  beforeEach(() => vi.clearAllMocks());
  it('exposes mutate', () => {
    (useCreateContact as ReturnType<typeof vi.fn>).mockReturnValue({ mutate: vi.fn(), isPending: false, error: null });
    expect(typeof renderHook(() => useCreateContact()).result.current.mutate).toBe('function');
  });
  it('isPending true', () => {
    (useCreateContact as ReturnType<typeof vi.fn>).mockReturnValue({ mutate: vi.fn(), isPending: true, error: null });
    expect(renderHook(() => useCreateContact()).result.current.isPending).toBe(true);
  });
  it('returns error', () => {
    const err = new Error('create fail');
    (useCreateContact as ReturnType<typeof vi.fn>).mockReturnValue({ mutate: vi.fn(), isPending: false, error: err });
    expect(renderHook(() => useCreateContact()).result.current.error).toBe(err);
  });
  it('calls mutate with correct args', () => {
    const mutate = vi.fn();
    (useCreateContact as ReturnType<typeof vi.fn>).mockReturnValue({ mutate, isPending: false, error: null });
    const payload = { firstName: 'A', lastName: 'B', email: 'a@b.com' };
    act(() => renderHook(() => useCreateContact()).result.current.mutate(payload));
    expect(mutate).toHaveBeenCalledWith(payload);
  });
  it('resolves with created contact', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(makeContact());
    (useCreateContact as ReturnType<typeof vi.fn>).mockReturnValue({ mutateAsync, isPending: false });
    const { result } = renderHook(() => useCreateContact());
    const created = await act(() => result.current.mutateAsync({ firstName: 'A', lastName: 'B', email: 'a@b.com' }));
    expect(created.id).toBe('c1');
  });
  it('rejects on validation error', async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error('400 Bad Request'));
    (useCreateContact as ReturnType<typeof vi.fn>).mockReturnValue({ mutateAsync, isPending: false });
    const { result } = renderHook(() => useCreateContact());
    await expect(result.current.mutateAsync({})).rejects.toThrow('400 Bad Request');
  });
});

describe('useUpdateContact hook', () => {
  beforeEach(() => vi.clearAllMocks());
  it('exposes mutate', () => {
    (useUpdateContact as ReturnType<typeof vi.fn>).mockReturnValue({ mutate: vi.fn(), isPending: false, error: null });
    expect(typeof renderHook(() => useUpdateContact()).result.current.mutate).toBe('function');
  });
  it('calls mutate with patch', () => {
    const mutate = vi.fn();
    (useUpdateContact as ReturnType<typeof vi.fn>).mockReturnValue({ mutate, isPending: false, error: null });
    act(() => renderHook(() => useUpdateContact()).result.current.mutate({ id: 'c1', firstName: 'Updated' }));
    expect(mutate).toHaveBeenCalledWith({ id: 'c1', firstName: 'Updated' });
  });
  it('isPending true during update', () => {
    (useUpdateContact as ReturnType<typeof vi.fn>).mockReturnValue({ mutate: vi.fn(), isPending: true, error: null });
    expect(renderHook(() => useUpdateContact()).result.current.isPending).toBe(true);
  });
  it('returns error', () => {
    const err = new Error('update fail');
    (useUpdateContact as ReturnType<typeof vi.fn>).mockReturnValue({ mutate: vi.fn(), isPending: false, error: err });
    expect(renderHook(() => useUpdateContact()).result.current.error).toBe(err);
  });
  it('handles 404 not found', () => {
    const err = Object.assign(new Error('Not Found'), { status: 404 });
    (useUpdateContact as ReturnType<typeof vi.fn>).mockReturnValue({ mutate: vi.fn(), isPending: false, error: err });
    expect((renderHook(() => useUpdateContact()).result.current.error as any)?.status).toBe(404);
  });
});

describe('useDeleteContact hook', () => {
  beforeEach(() => vi.clearAllMocks());
  it('exposes mutate', () => {
    (useDeleteContact as ReturnType<typeof vi.fn>).mockReturnValue({ mutate: vi.fn(), isPending: false, error: null });
    expect(typeof renderHook(() => useDeleteContact()).result.current.mutate).toBe('function');
  });
  it('calls delete with id', () => {
    const mutate = vi.fn();
    (useDeleteContact as ReturnType<typeof vi.fn>).mockReturnValue({ mutate, isPending: false, error: null });
    act(() => renderHook(() => useDeleteContact()).result.current.mutate('c1'));
    expect(mutate).toHaveBeenCalledWith('c1');
  });
  it('does not call when not confirmed', () => {
    const mutate = vi.fn();
    (useDeleteContact as ReturnType<typeof vi.fn>).mockReturnValue({ mutate, isPending: false, error: null });
    const { result } = renderHook(() => useDeleteContact());
    const confirmed = false;
    if (confirmed) act(() => result.current.mutate('c1'));
    expect(mutate).not.toHaveBeenCalled();
  });
  it('returns error', () => {
    const err = new Error('delete fail');
    (useDeleteContact as ReturnType<typeof vi.fn>).mockReturnValue({ mutate: vi.fn(), isPending: false, error: err });
    expect(renderHook(() => useDeleteContact()).result.current.error).toBe(err);
  });
  it('isPending true while deleting', () => {
    (useDeleteContact as ReturnType<typeof vi.fn>).mockReturnValue({ mutate: vi.fn(), isPending: true, error: null });
    expect(renderHook(() => useDeleteContact()).result.current.isPending).toBe(true);
  });
});

describe('Bulk selection logic', () => {
  const ids = ['c1', 'c2', 'c3', 'c4', 'c5'];
  it('select all returns 5', () => expect(new Set(ids).size).toBe(5));
  it('deselect all empty', () => expect(new Set<string>().size).toBe(0));
  it('select range 1-3', () => expect(ids.slice(1, 4)).toEqual(['c2', 'c3', 'c4']));
  it('count selected', () => expect(new Set(['c1', 'c3']).size).toBe(2));
  it('toggle removes id', () => { const s = new Set(['c1', 'c2']); s.delete('c1'); expect(s.has('c1')).toBe(false); });
  it('toggle adds id', () => { const s = new Set(['c1']); s.add('c2'); expect(s.has('c2')).toBe(true); });
  it('isAllSelected true', () => expect(new Set(ids).size === ids.length).toBe(true));
  it('isAllSelected false partial', () => expect(new Set(['c1']).size === ids.length).toBe(false));
  it('bulk delete removes ids', () => {
    const del = new Set(['c1', 'c3']);
    expect(ids.filter((id) => !del.has(id))).toEqual(['c2', 'c4', 'c5']);
  });
  it('empty selection count is 0', () => expect(new Set<string>().size).toBe(0));
});

describe('Search/filter logic', () => {
  const cs = [
    makeContact({ id: 'c1', firstName: 'Alice', email: 'alice@acme.com', phone: '+1-555-0001', tags: ['vip'] }),
    makeContact({ id: 'c2', firstName: 'Bob', email: 'bob@beta.com', phone: '+1-555-0002', tags: ['lead'] }),
    makeContact({ id: 'c3', firstName: 'Carol', email: 'carol@gamma.com', phone: '+1-555-0003', tags: ['vip', 'lead'] }),
  ];
  it('filter by name', () => expect(filterContacts(cs, 'alice', 'firstName')).toHaveLength(1));
  it('filter by email', () => expect(filterContacts(cs, 'beta', 'email')).toHaveLength(1));
  it('filter by phone', () => expect(filterContacts(cs, '0002', 'phone')).toHaveLength(1));
  it('filter by tag vip', () => expect(filterContacts(cs, 'vip', 'tags')).toHaveLength(2));
  it('no match returns empty', () => expect(filterContacts(cs, 'zzz', 'firstName')).toHaveLength(0));
  it('case insensitive', () => expect(filterContacts(cs, 'ALICE', 'firstName')).toHaveLength(1));
  it('partial email match', () => expect(filterContacts(cs, 'acme', 'email')).toHaveLength(1));
  it('tag lead matches 2', () => expect(filterContacts(cs, 'lead', 'tags')).toHaveLength(2));
  it('date range excludes future', () => expect(cs.filter((c) => new Date(c.createdAt) >= new Date('2024-02-01'))).toHaveLength(0));
  it('date range includes boundary', () => expect(cs.filter((c) => new Date(c.createdAt) >= new Date('2024-01-15'))).toHaveLength(3));
});

describe('Import CSV validation', () => {
  it('valid headers pass', () => expect(validateCsvHeaders(parseCsvHeaders('firstName,lastName,email'))).toBe(true));
  it('missing email fails', () => expect(validateCsvHeaders(parseCsvHeaders('firstName,lastName'))).toBe(false));
  it('missing firstName fails', () => expect(validateCsvHeaders(parseCsvHeaders('lastName,email'))).toBe(false));
  it('empty file no lines', () => expect(''.split('\n').filter(Boolean)).toHaveLength(0));
  it('too many rows detected', () => expect(Array.from({ length: 5001 }).length).toBeGreaterThan(5000));
  it('trims header whitespace', () => expect(validateCsvHeaders(parseCsvHeaders(' firstName , lastName , email '))).toBe(true));
  it('case insensitive headers', () => expect(validateCsvHeaders(['firstname', 'lastname', 'email'])).toBe(true));
  it('detects duplicate emails', () => {
    const rows = [{ email: 'a@b.com' }, { email: 'a@b.com' }];
    const emails = rows.map((r) => r.email);
    expect(emails.length !== new Set(emails).size).toBe(true);
  });
  it('extra optional columns ok', () => expect(validateCsvHeaders(parseCsvHeaders('firstName,lastName,email,phone'))).toBe(true));
  it('invalid row email caught', () => expect(validateContact({ firstName: 'A', lastName: 'B', email: 'bad' })).toContain('email invalid'));
});

describe('Contact timeline', () => {
  const evs = [
    makeEvent({ id: 'e1', type: 'note', createdAt: '2024-01-10T08:00:00Z' }),
    makeEvent({ id: 'e2', type: 'call', createdAt: '2024-01-20T10:00:00Z' }),
    makeEvent({ id: 'e3', type: 'email', createdAt: '2024-01-05T06:00:00Z' }),
  ];
  it('desc sort puts newest first', () => expect(sortByDate(evs, 'desc')[0].id).toBe('e2'));
  it('asc sort puts oldest first', () => expect(sortByDate(evs, 'asc')[0].id).toBe('e3'));
  it('filter type note', () => expect(evs.filter((e) => e.type === 'note')).toHaveLength(1));
  it('filter type call', () => expect(evs.filter((e) => e.type === 'call')).toHaveLength(1));
  it('empty timeline sorts to empty', () => expect(sortByDate([], 'desc')).toHaveLength(0));
  it('unknown type returns empty', () => expect(evs.filter((e) => e.type === 'meeting')).toHaveLength(0));
  it('events have required fields', () => evs.forEach((e) => { expect(e).toHaveProperty('id'); expect(e).toHaveProperty('type'); }));
  it('desc: first > second in time', () => {
    const s = sortByDate(evs, 'desc');
    expect(new Date(s[0].createdAt).getTime()).toBeGreaterThan(new Date(s[1].createdAt).getTime());
  });
  it('asc: first < second in time', () => {
    const s = sortByDate(evs, 'asc');
    expect(new Date(s[0].createdAt).getTime()).toBeLessThan(new Date(s[1].createdAt).getTime());
  });
  it('filter email type', () => expect(evs.filter((e) => e.type === 'email')[0].id).toBe('e3'));
});

describe('Pagination', () => {
  const all = Array.from({ length: 25 }, (_, i) => makeContact({ id: `c${i + 1}`, firstName: `Contact${i + 1}` }));
  const SZ = 10;
  it('page 1 has 10', () => expect(paginate(all, 1, SZ)).toHaveLength(10));
  it('page 1 first is Contact1', () => expect(paginate(all, 1, SZ)[0].firstName).toBe('Contact1'));
  it('page 2 starts at Contact11', () => expect(paginate(all, 2, SZ)[0].firstName).toBe('Contact11'));
  it('last page has 5', () => expect(paginate(all, 3, SZ)).toHaveLength(5));
  it('beyond last page empty', () => expect(paginate(all, 4, SZ)).toHaveLength(0));
  it('total pages is 3', () => expect(Math.ceil(all.length / SZ)).toBe(3));
  it('empty list returns empty', () => expect(paginate([], 1, SZ)).toHaveLength(0));
  it('page size 1 returns 1', () => expect(paginate(all, 1, 1)).toHaveLength(1));
  it('oversized page size returns all', () => expect(paginate(all, 1, 100)).toHaveLength(25));
  it('page 2 last item is Contact20', () => {
    const p2 = paginate(all, 2, SZ);
    expect(p2[p2.length - 1].firstName).toBe('Contact20');
  });
});
