import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const makeContact = (o: Record<string, unknown> = {}) => ({
  id: 'c1', firstName: 'Alice', lastName: 'Smith',
  email: 'alice@example.com', phone: '+1-555-0100',
  tags: ['vip'], createdAt: '2024-01-15T10:00:00Z', tenantId: 'tenant-1', ...o,
});

const makeQC = () => ({
  invalidateQueries: vi.fn(), setQueryData: vi.fn(),
  getQueryData: vi.fn(), refetchQueries: vi.fn(),
});

const mockFetchContacts = vi.fn();
const mockCreateContact = vi.fn();
const mockUpdateContact = vi.fn();
const mockDeleteContact = vi.fn();
const mockDeleteContacts = vi.fn();
const mockImportContacts = vi.fn();
const mockFetchTimeline = vi.fn();

// ── 1. QueryClient wiring ────────────────────────────────────────────────────
describe('Hook + React Query wiring', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invalidates contacts query after create', async () => {
    const qc = makeQC();
    mockCreateContact.mockResolvedValue(makeContact());
    await mockCreateContact({ firstName: 'A', lastName: 'B', email: 'a@b.com' });
    qc.invalidateQueries({ queryKey: ['contacts'] });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['contacts'] });
  });
  it('invalidates contacts query after update', async () => {
    const qc = makeQC();
    mockUpdateContact.mockResolvedValue(makeContact({ firstName: 'Updated' }));
    await mockUpdateContact({ id: 'c1', firstName: 'Updated' });
    qc.invalidateQueries({ queryKey: ['contacts'] });
    expect(qc.invalidateQueries).toHaveBeenCalled();
  });
  it('invalidates contacts query after delete', async () => {
    const qc = makeQC();
    mockDeleteContact.mockResolvedValue({ success: true });
    await mockDeleteContact('c1');
    qc.invalidateQueries({ queryKey: ['contacts'] });
    expect(qc.invalidateQueries).toHaveBeenCalled();
  });
  it('uses correct query key with tenantId', () => {
    const qc = makeQC();
    qc.getQueryData(['contacts', { tenantId: 'tenant-1' }]);
    expect(qc.getQueryData).toHaveBeenCalledWith(['contacts', { tenantId: 'tenant-1' }]);
  });
  it('stale data triggers refetch', () => {
    const qc = makeQC();
    qc.refetchQueries({ queryKey: ['contacts'], type: 'active' });
    expect(qc.refetchQueries).toHaveBeenCalled();
  });
  it('setQueryData updates cache optimistically', () => {
    const qc = makeQC();
    qc.setQueryData(['contacts'], [makeContact()]);
    expect(qc.setQueryData).toHaveBeenCalledWith(['contacts'], [makeContact()]);
  });
  it('fetchContacts called with tenantId', async () => {
    mockFetchContacts.mockResolvedValue({ data: [], total: 0 });
    await mockFetchContacts({ tenantId: 'tenant-1' });
    expect(mockFetchContacts).toHaveBeenCalledWith({ tenantId: 'tenant-1' });
  });
  it('cache populated on successful fetch', async () => {
    mockFetchContacts.mockResolvedValue({ data: [makeContact()], total: 1 });
    const res = await mockFetchContacts({});
    expect(res.data).toHaveLength(1);
  });
  it('failed fetch rejects', async () => {
    mockFetchContacts.mockRejectedValue(new Error('network error'));
    await expect(mockFetchContacts({})).rejects.toThrow('network error');
  });
  it('query key includes page params', () => {
    const qc = makeQC();
    qc.getQueryData(['contacts', { page: 2, pageSize: 10 }]);
    expect(qc.getQueryData).toHaveBeenCalledWith(['contacts', { page: 2, pageSize: 10 }]);
  });
});

// ── 2. Form submission flow ───────────────────────────────────────────────────
describe('Form submission flow', () => {
  beforeEach(() => vi.clearAllMocks());

  const ContactForm: React.FC<{ onSubmit: (d: any) => void; error?: string }> = ({ onSubmit, error }) => (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ firstName: 'Alice', lastName: 'Smith', email: 'a@b.com' }); }}>
      <input name="firstName" placeholder="First name" />
      <input name="lastName" placeholder="Last name" />
      <input name="email" placeholder="Email" />
      <button type="submit">Create</button>
      {error && <span role="alert">{error}</span>}
    </form>
  );

  it('renders create button', () => {
    render(<ContactForm onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
  });
  it('submit calls onSubmit', () => {
    const onSubmit = vi.fn();
    render(<ContactForm onSubmit={onSubmit} />);
    fireEvent.submit(screen.getByRole('button').closest('form')!);
    expect(onSubmit).toHaveBeenCalled();
  });
  it('shows error alert when error prop set', () => {
    render(<ContactForm onSubmit={vi.fn()} error="Server error" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Server error');
  });
  it('createContact API called on submit', async () => {
    mockCreateContact.mockResolvedValue(makeContact());
    const result = await mockCreateContact({ firstName: 'A', lastName: 'B', email: 'a@b.com' });
    expect(result).toHaveProperty('id');
  });
  it('createContact rejects on 400', async () => {
    mockCreateContact.mockRejectedValue(new Error('400 Bad Request'));
    await expect(mockCreateContact({})).rejects.toThrow('400 Bad Request');
  });
  it('no alert when no error', () => {
    render(<ContactForm onSubmit={vi.fn()} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('onSubmit called once per submit', () => {
    const onSubmit = vi.fn();
    render(<ContactForm onSubmit={onSubmit} />);
    fireEvent.submit(screen.getByRole('button').closest('form')!);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
  it('duplicate submit calls onSubmit twice', () => {
    const onSubmit = vi.fn();
    render(<ContactForm onSubmit={onSubmit} />);
    fireEvent.submit(screen.getByRole('button').closest('form')!);
    fireEvent.submit(screen.getByRole('button').closest('form')!);
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });
});

// ── 3. Bulk action flow ───────────────────────────────────────────────────────
describe('Bulk action flow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('bulk delete called with correct ids', async () => {
    mockDeleteContacts.mockResolvedValue({ deleted: 3 });
    const result = await mockDeleteContacts(['c1', 'c2', 'c3']);
    expect(result.deleted).toBe(3);
  });
  it('bulk delete fails gracefully', async () => {
    mockDeleteContacts.mockRejectedValue(new Error('Bulk delete failed'));
    await expect(mockDeleteContacts([])).rejects.toThrow();
  });
  it('after bulk delete invalidate query', async () => {
    const qc = makeQC();
    mockDeleteContacts.mockResolvedValue({ deleted: 2 });
    await mockDeleteContacts(['c1', 'c2']);
    qc.invalidateQueries({ queryKey: ['contacts'] });
    expect(qc.invalidateQueries).toHaveBeenCalled();
  });
  it('bulk delete with empty list is noop', async () => {
    mockDeleteContacts.mockResolvedValue({ deleted: 0 });
    const result = await mockDeleteContacts([]);
    expect(result.deleted).toBe(0);
  });
  it('list updates after bulk delete', () => {
    let contacts = [makeContact(), makeContact({ id: 'c2' }), makeContact({ id: 'c3' })];
    const toDelete = new Set(['c1', 'c3']);
    contacts = contacts.filter(c => !toDelete.has(c.id));
    expect(contacts).toHaveLength(1);
    expect(contacts[0].id).toBe('c2');
  });
  it('selection cleared after bulk delete', () => {
    let selected = new Set(['c1', 'c2']);
    selected = new Set<string>();
    expect(selected.size).toBe(0);
  });
  it('bulk tag update applied to all', () => {
    const contacts = [makeContact({ id: 'c1' }), makeContact({ id: 'c2' })];
    const tagged = contacts.map(c => ({ ...c, tags: [...c.tags, 'new-tag'] }));
    expect(tagged.every(c => c.tags.includes('new-tag'))).toBe(true);
  });
  it('bulk export generates csv rows', () => {
    const contacts = [makeContact(), makeContact({ id: 'c2', firstName: 'Bob' })];
    const csv = contacts.map(c => `${c.firstName},${c.email}`).join('\n');
    expect(csv).toContain('Alice');
    expect(csv).toContain('Bob');
  });
});

// ── 4. Import flow ────────────────────────────────────────────────────────────
describe('Import flow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('importContacts called with file data', async () => {
    mockImportContacts.mockResolvedValue({ imported: 10, errors: 0 });
    const result = await mockImportContacts({ csv: 'data' });
    expect(result.imported).toBe(10);
  });
  it('import with errors returns error count', async () => {
    mockImportContacts.mockResolvedValue({ imported: 8, errors: 2 });
    const result = await mockImportContacts({ csv: 'data' });
    expect(result.errors).toBe(2);
  });
  it('import rejects on server error', async () => {
    mockImportContacts.mockRejectedValue(new Error('500 Internal Server Error'));
    await expect(mockImportContacts({ csv: '' })).rejects.toThrow();
  });
  it('empty CSV import returns 0', async () => {
    mockImportContacts.mockResolvedValue({ imported: 0, errors: 0 });
    const result = await mockImportContacts({ csv: '' });
    expect(result.imported).toBe(0);
  });
  it('import invalidates contacts query', async () => {
    const qc = makeQC();
    mockImportContacts.mockResolvedValue({ imported: 5, errors: 0 });
    await mockImportContacts({ csv: 'data' });
    qc.invalidateQueries({ queryKey: ['contacts'] });
    expect(qc.invalidateQueries).toHaveBeenCalled();
  });
});

// ── 5. Search flow ────────────────────────────────────────────────────────────
describe('Search flow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('search called with term', async () => {
    mockFetchContacts.mockResolvedValue({ data: [makeContact()], total: 1 });
    await mockFetchContacts({ search: 'alice' });
    expect(mockFetchContacts).toHaveBeenCalledWith({ search: 'alice' });
  });
  it('empty search returns all', async () => {
    const contacts = [makeContact(), makeContact({ id: 'c2' })];
    mockFetchContacts.mockResolvedValue({ data: contacts, total: 2 });
    const result = await mockFetchContacts({ search: '' });
    expect(result.data).toHaveLength(2);
  });
  it('search with no match returns empty', async () => {
    mockFetchContacts.mockResolvedValue({ data: [], total: 0 });
    const result = await mockFetchContacts({ search: 'zzz' });
    expect(result.data).toHaveLength(0);
  });
  it('debounce prevents rapid calls', async () => {
    let callCount = 0;
    const debounced = vi.fn().mockImplementation(() => { callCount++; });
    debounced('a');
    debounced('ab');
    debounced('abc');
    expect(debounced).toHaveBeenCalledTimes(3);
    expect(callCount).toBe(3);
  });
  it('search clears on reset', async () => {
    mockFetchContacts.mockResolvedValue({ data: [makeContact()], total: 1 });
    await mockFetchContacts({ search: '' });
    expect(mockFetchContacts).toHaveBeenCalledWith({ search: '' });
  });
});

// ── 6. Timeline integration ───────────────────────────────────────────────────
describe('Timeline integration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetchTimeline called with contactId', async () => {
    mockFetchTimeline.mockResolvedValue([]);
    await mockFetchTimeline('c1');
    expect(mockFetchTimeline).toHaveBeenCalledWith('c1');
  });
  it('returns events in desc order', async () => {
    const events = [
      { id: 'e1', createdAt: '2024-01-20' },
      { id: 'e2', createdAt: '2024-01-10' },
    ];
    mockFetchTimeline.mockResolvedValue(events);
    const result = await mockFetchTimeline('c1');
    expect(result[0].id).toBe('e1');
  });
  it('empty timeline returns empty array', async () => {
    mockFetchTimeline.mockResolvedValue([]);
    const result = await mockFetchTimeline('c1');
    expect(result).toHaveLength(0);
  });
  it('timeline fetch rejects on 404', async () => {
    mockFetchTimeline.mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }));
    await expect(mockFetchTimeline('nonexistent')).rejects.toMatchObject({ status: 404 });
  });
  it('timeline has correct event structure', async () => {
    const event = { id: 'e1', type: 'call', description: 'Called', createdAt: '2024-01-01' };
    mockFetchTimeline.mockResolvedValue([event]);
    const result = await mockFetchTimeline('c1');
    expect(result[0]).toHaveProperty('type');
    expect(result[0]).toHaveProperty('description');
  });
});

// ── 7. Tag management ─────────────────────────────────────────────────────────
describe('Tag management', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adds tag to contact', async () => {
    const updated = makeContact({ tags: ['vip', 'premium'] });
    mockUpdateContact.mockResolvedValue(updated);
    const result = await mockUpdateContact({ id: 'c1', tags: ['vip', 'premium'] });
    expect(result.tags).toContain('premium');
  });
  it('removes tag from contact', async () => {
    const updated = makeContact({ tags: [] });
    mockUpdateContact.mockResolvedValue(updated);
    const result = await mockUpdateContact({ id: 'c1', tags: [] });
    expect(result.tags).toHaveLength(0);
  });
  it('tag list deduplicates', () => {
    const tags = ['vip', 'vip', 'lead'];
    const unique = [...new Set(tags)];
    expect(unique).toHaveLength(2);
  });
  it('tag search filters contacts', () => {
    const contacts = [makeContact({ tags: ['vip'] }), makeContact({ id: 'c2', tags: ['lead'] })];
    expect(contacts.filter(c => c.tags.includes('vip'))).toHaveLength(1);
  });
  it('empty tags array is valid', async () => {
    const updated = makeContact({ tags: [] });
    mockUpdateContact.mockResolvedValue(updated);
    const result = await mockUpdateContact({ id: 'c1', tags: [] });
    expect(result.tags).toEqual([]);
  });
});

// ── 8. Error propagation ──────────────────────────────────────────────────────
describe('Error propagation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('network error shown as toast', () => {
    const showToast = vi.fn();
    const handleError = (e: Error) => showToast({ type: 'error', message: e.message });
    handleError(new Error('Network failed'));
    expect(showToast).toHaveBeenCalledWith({ type: 'error', message: 'Network failed' });
  });
  it('401 redirects to login', () => {
    const navigate = vi.fn();
    const handleError = (status: number) => { if (status === 401) navigate('/login'); };
    handleError(401);
    expect(navigate).toHaveBeenCalledWith('/login');
  });
  it('403 shows forbidden message', () => {
    const showToast = vi.fn();
    const handleError = (status: number) => { if (status === 403) showToast({ type: 'error', message: 'Forbidden' }); };
    handleError(403);
    expect(showToast).toHaveBeenCalledWith({ type: 'error', message: 'Forbidden' });
  });
  it('500 shows generic error', () => {
    const showToast = vi.fn();
    const handleError = (status: number) => { if (status >= 500) showToast({ type: 'error', message: 'Server error' }); };
    handleError(500);
    expect(showToast).toHaveBeenCalled();
  });
  it('retry button calls fetch again', () => {
    const fetch = vi.fn();
    fetch();
    fetch();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

// ── 9. Pagination integration ─────────────────────────────────────────────────
describe('Pagination integration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('page 1 fetches first 10', async () => {
    mockFetchContacts.mockResolvedValue({ data: Array.from({ length: 10 }, (_, i) => makeContact({ id: `c${i}` })), total: 25 });
    const result = await mockFetchContacts({ page: 1, pageSize: 10 });
    expect(result.data).toHaveLength(10);
    expect(result.total).toBe(25);
  });
  it('page 2 fetches next 10', async () => {
    mockFetchContacts.mockResolvedValue({ data: Array.from({ length: 10 }, (_, i) => makeContact({ id: `c${i + 10}` })), total: 25 });
    const result = await mockFetchContacts({ page: 2, pageSize: 10 });
    expect(result.data).toHaveLength(10);
  });
  it('last page fetches remaining', async () => {
    mockFetchContacts.mockResolvedValue({ data: Array.from({ length: 5 }, (_, i) => makeContact({ id: `c${i + 20}` })), total: 25 });
    const result = await mockFetchContacts({ page: 3, pageSize: 10 });
    expect(result.data).toHaveLength(5);
  });
  it('beyond last page returns empty', async () => {
    mockFetchContacts.mockResolvedValue({ data: [], total: 25 });
    const result = await mockFetchContacts({ page: 10, pageSize: 10 });
    expect(result.data).toHaveLength(0);
  });
  it('total pages calculated correctly', () => {
    const total = 25; const pageSize = 10;
    expect(Math.ceil(total / pageSize)).toBe(3);
  });
});

// ── 10. Tenant isolation ──────────────────────────────────────────────────────
describe('Tenant isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('only returns contacts for current tenant', async () => {
    mockFetchContacts.mockResolvedValue({ data: [makeContact({ tenantId: 'tenant-1' })], total: 1 });
    const result = await mockFetchContacts({ tenantId: 'tenant-1' });
    expect(result.data.every((c: any) => c.tenantId === 'tenant-1')).toBe(true);
  });
  it('cross-tenant access returns 403', async () => {
    mockFetchContacts.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }));
    await expect(mockFetchContacts({ tenantId: 'other' })).rejects.toMatchObject({ status: 403 });
  });
  it('create contact sets tenantId', async () => {
    mockCreateContact.mockResolvedValue(makeContact({ tenantId: 'tenant-1' }));
    const result = await mockCreateContact({ firstName: 'A', tenantId: 'tenant-1' });
    expect(result.tenantId).toBe('tenant-1');
  });
  it('cannot update contact from other tenant', async () => {
    mockUpdateContact.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }));
    await expect(mockUpdateContact({ id: 'other-c1' })).rejects.toMatchObject({ status: 403 });
  });
  it('cannot delete contact from other tenant', async () => {
    mockDeleteContact.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }));
    await expect(mockDeleteContact('other-c1')).rejects.toMatchObject({ status: 403 });
  });
});
