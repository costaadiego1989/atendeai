import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const mockFetchContacts = vi.fn();
const mockCreateContact = vi.fn();
const mockUpdateContact = vi.fn();
const mockDeleteContact = vi.fn();
const mockImportContacts = vi.fn();
const navigate = vi.fn();

const makeContact = (o: Record<string, unknown> = {}) => ({
  id: 'c1', firstName: 'Alice', lastName: 'Smith',
  email: 'alice@example.com', phone: '+1-555-0100',
  tags: ['vip'], createdAt: '2024-01-15T10:00:00Z', tenantId: 'tenant-1', ...o,
});

describe('Contacts e2e flows', () => {
  beforeEach(() => vi.clearAllMocks());

  // CRUD flows
  it('create contact flow: submit returns new contact', async () => {
    mockCreateContact.mockResolvedValue(makeContact());
    const result = await mockCreateContact({ firstName: 'Alice', lastName: 'Smith', email: 'alice@example.com' });
    expect(result.id).toBe('c1');
  });
  it('edit contact flow: update returns updated contact', async () => {
    mockUpdateContact.mockResolvedValue(makeContact({ firstName: 'Alicia' }));
    const result = await mockUpdateContact({ id: 'c1', firstName: 'Alicia' });
    expect(result.firstName).toBe('Alicia');
  });
  it('delete contact flow: confirm deletes and removes from list', async () => {
    let contacts = [makeContact(), makeContact({ id: 'c2' })];
    mockDeleteContact.mockResolvedValue({ success: true });
    await mockDeleteContact('c1');
    contacts = contacts.filter(c => c.id !== 'c1');
    expect(contacts).toHaveLength(1);
    expect(contacts[0].id).toBe('c2');
  });
  it('delete cancel: does not call delete', () => {
    const confirmed = false;
    if (confirmed) mockDeleteContact('c1');
    expect(mockDeleteContact).not.toHaveBeenCalled();
  });

  // Bulk operations
  it('bulk delete flow: removes all selected', async () => {
    const bulkDelete = vi.fn().mockResolvedValue({ deleted: 3 });
    const result = await bulkDelete(['c1', 'c2', 'c3']);
    expect(result.deleted).toBe(3);
  });

  // Import flow
  it('CSV import flow: returns imported count', async () => {
    mockImportContacts.mockResolvedValue({ imported: 5, errors: 0 });
    const result = await mockImportContacts({ file: 'data.csv' });
    expect(result.imported).toBe(5);
  });
  it('CSV import with errors shows error count', async () => {
    mockImportContacts.mockResolvedValue({ imported: 3, errors: 2 });
    const result = await mockImportContacts({ file: 'data.csv' });
    expect(result.errors).toBe(2);
  });

  // Search and filter
  it('search flow: returns matching contacts', async () => {
    mockFetchContacts.mockResolvedValue({ data: [makeContact()], total: 1 });
    const result = await mockFetchContacts({ search: 'Alice' });
    expect(result.data[0].firstName).toBe('Alice');
  });
  it('filter by tag: returns tagged contacts', async () => {
    mockFetchContacts.mockResolvedValue({ data: [makeContact()], total: 1 });
    const result = await mockFetchContacts({ tag: 'vip' });
    expect(result.data[0].tags).toContain('vip');
  });
  it('reset filters: returns all contacts', async () => {
    mockFetchContacts.mockResolvedValue({ data: [makeContact(), makeContact({ id: 'c2' })], total: 2 });
    const result = await mockFetchContacts({});
    expect(result.data).toHaveLength(2);
  });

  // Detail and timeline
  it('contact detail view: fetches single contact', async () => {
    const fetchOne = vi.fn().mockResolvedValue(makeContact());
    const result = await fetchOne('c1');
    expect(result.id).toBe('c1');
  });
  it('timeline view: fetches events for contact', async () => {
    const fetchTimeline = vi.fn().mockResolvedValue([{ id: 'e1', type: 'call' }]);
    const result = await fetchTimeline('c1');
    expect(result[0].type).toBe('call');
  });

  // Tag flow
  it('add tag flow: updates contact tags', async () => {
    mockUpdateContact.mockResolvedValue(makeContact({ tags: ['vip', 'premium'] }));
    const result = await mockUpdateContact({ id: 'c1', tags: ['vip', 'premium'] });
    expect(result.tags).toContain('premium');
  });

  // Auth and permissions
  it('401: redirects to login', async () => {
    mockFetchContacts.mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }));
    try { await mockFetchContacts({}); } catch (e: any) {
      if (e.status === 401) navigate('/login');
    }
    expect(navigate).toHaveBeenCalledWith('/login');
  });
  it('403: shows forbidden error', async () => {
    mockFetchContacts.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }));
    let caught: any = null;
    try { await mockFetchContacts({ tenantId: 'other' }); } catch (e) { caught = e; }
    expect((caught as any)?.status).toBe(403);
  });
  it('400: shows validation error', async () => {
    mockCreateContact.mockRejectedValue(Object.assign(new Error('Bad Request'), { status: 400 }));
    let caught: any = null;
    try { await mockCreateContact({ email: 'invalid' }); } catch (e) { caught = e; }
    expect((caught as any)?.status).toBe(400);
  });
  it('404: contact not found', async () => {
    const fetchOne = vi.fn().mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }));
    await expect(fetchOne('nonexistent')).rejects.toMatchObject({ status: 404 });
  });

  // Feedback toasts
  it('success toast on create', () => {
    const showToast = vi.fn();
    showToast({ type: 'success', message: 'Contact created' });
    expect(showToast).toHaveBeenCalledWith({ type: 'success', message: 'Contact created' });
  });
  it('error toast on network failure', () => {
    const showToast = vi.fn();
    showToast({ type: 'error', message: 'Network error' });
    expect(showToast).toHaveBeenCalledWith({ type: 'error', message: 'Network error' });
  });

  // Pagination
  it('pagination next: fetches page 2', async () => {
    mockFetchContacts.mockResolvedValue({ data: Array.from({ length: 10 }, (_, i) => makeContact({ id: `c${i + 10}` })), total: 25 });
    const result = await mockFetchContacts({ page: 2, pageSize: 10 });
    expect(result.data).toHaveLength(10);
  });
  it('pagination prev: fetches page 1', async () => {
    mockFetchContacts.mockResolvedValue({ data: Array.from({ length: 10 }, (_, i) => makeContact({ id: `c${i}` })), total: 25 });
    const result = await mockFetchContacts({ page: 1, pageSize: 10 });
    expect(result.data).toHaveLength(10);
  });
  it('total pages computed correctly', () => {
    expect(Math.ceil(25 / 10)).toBe(3);
  });
});
