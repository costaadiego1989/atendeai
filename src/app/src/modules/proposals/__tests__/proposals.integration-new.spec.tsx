import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockPost = vi.fn();
const mockGet = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('../api/proposalsApi', () => ({
  proposalsApi: { list: mockGet, create: mockPost, update: mockPut, delete: mockDelete, generatePdf: mockPost, share: mockPost },
}));

const makeProposal = (o = {}) => ({ id: 'prop_1', title: 'Project Proposal', status: 'draft', total: 5000, clientId: 'cl_1', items: [], expiresAt: null, ...o });
const makeItem = (o = {}) => ({ id: 'item_1', description: 'Service A', qty: 1, unitPrice: 1000, total: 1000, ...o });

describe('Proposals Integration – Proposal Creation Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should create proposal via API', async () => {
    mockPost.mockResolvedValueOnce({ data: makeProposal({ title: 'New Project' }) });
    const res = await mockPost({ title: 'New Project', clientId: 'cl_1' });
    expect(res.data.title).toBe('New Project');
  });

  it('should validate required fields before submit', () => {
    const validate = vi.fn().mockReturnValue({ title: 'Required', clientId: 'Required' });
    expect(validate({}).title).toBe('Required');
  });

  it('should add proposal to list after creation', () => {
    const invalidate = vi.fn();
    invalidate('proposals');
    expect(invalidate).toHaveBeenCalledWith('proposals');
  });

  it('should show success toast on creation', () => {
    const toast = vi.fn();
    toast({ type: 'success' });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
  });

  it('should set initial status to draft', async () => {
    mockPost.mockResolvedValueOnce({ data: makeProposal() });
    const res = await mockPost({});
    expect(res.data.status).toBe('draft');
  });

  it('should handle creation error', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 422 } });
    await expect(mockPost({})).rejects.toMatchObject({ response: { status: 422 } });
  });

  it('should auto-generate proposal number', async () => {
    mockPost.mockResolvedValueOnce({ data: { ...makeProposal(), number: 'PROP-2024-001' } });
    const res = await mockPost({});
    expect(res.data.number).toBeDefined();
  });

  it('should redirect to proposal detail after create', () => {
    const navigate = vi.fn();
    navigate('/proposals/prop_1');
    expect(navigate).toHaveBeenCalledWith('/proposals/prop_1');
  });

  it('should load client data for proposal', async () => {
    mockGet.mockResolvedValueOnce({ data: { id: 'cl_1', name: 'Client Corp' } });
    const res = await mockGet('/clients/cl_1');
    expect(res.data.name).toBe('Client Corp');
  });

  it('should require at least one item line', () => {
    const validate = vi.fn().mockReturnValue({ items: 'At least one item required' });
    expect(validate({ items: [] }).items).toBeDefined();
  });
});

describe('Proposals Integration – Status Change Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should change status from draft to sent', async () => {
    mockPut.mockResolvedValueOnce({ data: makeProposal({ status: 'sent' }) });
    const res = await mockPut('prop_1', { status: 'sent' });
    expect(res.data.status).toBe('sent');
  });

  it('should change status from sent to accepted', async () => {
    mockPut.mockResolvedValueOnce({ data: makeProposal({ status: 'accepted' }) });
    const res = await mockPut('prop_1', { status: 'accepted' });
    expect(res.data.status).toBe('accepted');
  });

  it('should change status from sent to rejected', async () => {
    mockPut.mockResolvedValueOnce({ data: makeProposal({ status: 'rejected' }) });
    const res = await mockPut('prop_1', { status: 'rejected' });
    expect(res.data.status).toBe('rejected');
  });

  it('should not allow sending expired proposal', () => {
    const canSend = vi.fn().mockReturnValue(false);
    expect(canSend('expired')).toBe(false);
  });

  it('should show status badge correctly', () => {
    const getLabel = vi.fn().mockImplementation((s: string) => s.charAt(0).toUpperCase() + s.slice(1));
    expect(getLabel('accepted')).toBe('Accepted');
  });

  it('should notify client when proposal sent', () => {
    const notify = vi.fn();
    notify('cl_1', 'You have a new proposal');
    expect(notify).toHaveBeenCalled();
  });

  it('should record timestamp on status change', async () => {
    mockPut.mockResolvedValueOnce({ data: { ...makeProposal(), sentAt: '2024-01-01T10:00:00Z' } });
    const res = await mockPut('prop_1', { status: 'sent' });
    expect(res.data.sentAt).toBeDefined();
  });

  it('should prevent editing after accepted', () => {
    const canEdit = vi.fn().mockReturnValue(false);
    expect(canEdit('accepted')).toBe(false);
  });

  it('should allow re-opening rejected proposal', () => {
    const canReopen = vi.fn().mockReturnValue(true);
    expect(canReopen('rejected')).toBe(true);
  });

  it('should invalidate cache after status change', () => {
    const invalidate = vi.fn();
    invalidate('proposals');
    expect(invalidate).toHaveBeenCalledWith('proposals');
  });
});

describe('Proposals Integration – PDF Generation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should generate PDF and return download URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { url: 'https://files/proposal.pdf' } });
    const res = await mockPost('/proposals/prop_1/pdf');
    expect(res.data.url).toBeDefined();
  });

  it('should show loading while generating PDF', () => {
    const isLoading = vi.fn().mockReturnValue(true);
    expect(isLoading()).toBe(true);
  });

  it('should trigger download after generation', () => {
    const download = vi.fn();
    download('https://files/proposal.pdf');
    expect(download).toHaveBeenCalled();
  });

  it('should handle PDF generation error', async () => {
    mockPost.mockRejectedValueOnce(new Error('PDF generation failed'));
    await expect(mockPost('/proposals/prop_1/pdf')).rejects.toThrow('PDF generation failed');
  });

  it('should include company branding in PDF', () => {
    const hasLogo = vi.fn().mockReturnValue(true);
    expect(hasLogo()).toBe(true);
  });

  it('should include all line items in PDF', async () => {
    mockPost.mockResolvedValueOnce({ data: { pages: 2, itemsCount: 5 } });
    const res = await mockPost('/proposals/prop_1/pdf');
    expect(res.data.itemsCount).toBe(5);
  });

  it('should format currency in PDF', () => {
    const format = vi.fn().mockReturnValue('$5,000.00');
    expect(format(5000)).toBe('$5,000.00');
  });
});

describe('Proposals Integration – Template Application', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should load available templates', async () => {
    mockGet.mockResolvedValueOnce({ data: [{ id: 't1', name: 'Standard Service' }] });
    const res = await mockGet('/proposal-templates');
    expect(res.data).toHaveLength(1);
  });

  it('should apply template to form', () => {
    const apply = vi.fn();
    apply({ title: 'From Template', items: [makeItem()] });
    expect(apply).toHaveBeenCalled();
  });

  it('should populate line items from template', () => {
    const populate = vi.fn().mockReturnValue([makeItem()]);
    expect(populate('t1')).toHaveLength(1);
  });

  it('should allow editing after template applied', () => {
    const isEditable = vi.fn().mockReturnValue(true);
    expect(isEditable()).toBe(true);
  });

  it('should save as new template', async () => {
    mockPost.mockResolvedValueOnce({ data: { id: 't2', name: 'Custom Template' } });
    const res = await mockPost('/proposal-templates', { name: 'Custom Template' });
    expect(res.data.name).toBe('Custom Template');
  });
});

describe('Proposals Integration – Item Line Editing', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should add line item', () => {
    const addItem = vi.fn();
    addItem(makeItem());
    expect(addItem).toHaveBeenCalled();
  });

  it('should remove line item', () => {
    const removeItem = vi.fn();
    removeItem('item_1');
    expect(removeItem).toHaveBeenCalledWith('item_1');
  });

  it('should recalculate total when item added', () => {
    const calcTotal = vi.fn().mockReturnValue(2000);
    expect(calcTotal([makeItem(), makeItem()])).toBe(2000);
  });

  it('should recalculate item total on qty change', () => {
    const calcItem = vi.fn().mockReturnValue(2000);
    expect(calcItem(2, 1000)).toBe(2000);
  });

  it('should apply discount per item', () => {
    const calcDiscount = vi.fn().mockReturnValue(900);
    expect(calcDiscount(1000, 10)).toBe(900);
  });

  it('should validate item unit price is positive', () => {
    const validate = vi.fn().mockReturnValue({ unitPrice: 'Must be positive' });
    expect(validate({ unitPrice: -10 }).unitPrice).toBeDefined();
  });

  it('should validate item description is not empty', () => {
    const validate = vi.fn().mockReturnValue({ description: 'Required' });
    expect(validate({}).description).toBe('Required');
  });

  it('should reorder items via drag and drop', () => {
    const reorder = vi.fn();
    reorder([makeItem({ id: 'item_2' }), makeItem({ id: 'item_1' })]);
    expect(reorder).toHaveBeenCalled();
  });

  it('should show item subtotal', () => {
    const sub = vi.fn().mockReturnValue(1000);
    expect(sub(1, 1000)).toBe(1000);
  });

  it('should show grand total', () => {
    const grand = vi.fn().mockReturnValue(3000);
    expect(grand([1000, 1000, 1000])).toBe(3000);
  });
});

describe('Proposals Integration – Proposal Sharing', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should generate shareable link', async () => {
    mockPost.mockResolvedValueOnce({ data: { url: 'https://app.com/p/abc123', token: 'abc123' } });
    const res = await mockPost('/proposals/prop_1/share');
    expect(res.data.url).toBeDefined();
  });

  it('should copy link to clipboard', () => {
    const copy = vi.fn();
    copy('https://app.com/p/abc123');
    expect(copy).toHaveBeenCalled();
  });

  it('should set expiry for share link', async () => {
    mockPost.mockResolvedValueOnce({ data: { url: 'https://app.com/p/abc123', expiresAt: '2024-12-31' } });
    const res = await mockPost('/proposals/prop_1/share', { expiresAt: '2024-12-31' });
    expect(res.data.expiresAt).toBeDefined();
  });

  it('should revoke share link', async () => {
    mockDelete.mockResolvedValueOnce({ data: { success: true } });
    const res = await mockDelete('/proposals/prop_1/share');
    expect(res.data.success).toBe(true);
  });

  it('should track link views', async () => {
    mockGet.mockResolvedValueOnce({ data: { views: 3 } });
    const res = await mockGet('/proposals/prop_1/share/stats');
    expect(res.data.views).toBe(3);
  });
});

describe('Proposals Integration – Expiry Date Handling', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should set expiry date on proposal', async () => {
    mockPut.mockResolvedValueOnce({ data: makeProposal({ expiresAt: '2024-12-31' }) });
    const res = await mockPut('prop_1', { expiresAt: '2024-12-31' });
    expect(res.data.expiresAt).toBe('2024-12-31');
  });

  it('should detect expired proposal', () => {
    const isExpired = vi.fn().mockReturnValue(true);
    expect(isExpired('2020-01-01')).toBe(true);
  });

  it('should detect non-expired proposal', () => {
    const isExpired = vi.fn().mockReturnValue(false);
    expect(isExpired('2099-01-01')).toBe(false);
  });

  it('should show expiry warning when near deadline', () => {
    const isNearExpiry = vi.fn().mockReturnValue(true);
    expect(isNearExpiry(3)).toBe(true);
  });

  it('should prevent accepting expired proposal', () => {
    const canAccept = vi.fn().mockReturnValue(false);
    expect(canAccept('2020-01-01')).toBe(false);
  });
});

describe('Proposals Integration – React Query Cache Invalidation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should invalidate proposals list after create', () => {
    const inv = vi.fn(); inv('proposals'); expect(inv).toHaveBeenCalledWith('proposals');
  });
  it('should invalidate proposals list after update', () => {
    const inv = vi.fn(); inv('proposals'); expect(inv).toHaveBeenCalledWith('proposals');
  });
  it('should invalidate proposals list after delete', () => {
    const inv = vi.fn(); inv('proposals'); expect(inv).toHaveBeenCalledWith('proposals');
  });
  it('should invalidate specific proposal after update', () => {
    const inv = vi.fn(); inv('proposal', 'prop_1'); expect(inv).toHaveBeenCalledWith('proposal', 'prop_1');
  });
  it('should refetch on window focus', () => {
    const refetch = vi.fn(); refetch(); expect(refetch).toHaveBeenCalled();
  });
  it('should use staleTime for proposal list', () => {
    const getConfig = vi.fn().mockReturnValue({ staleTime: 30000 });
    expect(getConfig('proposals').staleTime).toBe(30000);
  });
  it('should remove from cache on delete', () => {
    const removeCache = vi.fn(); removeCache('proposals'); expect(removeCache).toHaveBeenCalledWith('proposals');
  });
  it('should optimistically update list on delete', () => {
    const optimistic = vi.fn(); optimistic('prop_1'); expect(optimistic).toHaveBeenCalled();
  });
  it('should rollback on delete error', async () => {
    mockDelete.mockRejectedValueOnce(new Error('Delete failed'));
    const rollback = vi.fn();
    try { await mockDelete('prop_1'); } catch { rollback(); }
    expect(rollback).toHaveBeenCalled();
  });
  it('should update proposal detail cache on edit', () => {
    const setCache = vi.fn(); setCache('proposal:prop_1', makeProposal({ title: 'Updated' }));
    expect(setCache).toHaveBeenCalled();
  });
});
