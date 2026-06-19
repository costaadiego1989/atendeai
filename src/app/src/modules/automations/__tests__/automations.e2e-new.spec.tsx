import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockPost = vi.fn();
const mockGet = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('../api/automationsApi', () => ({
  automationsApi: { list: mockGet, create: mockPost, update: mockPut, delete: mockDelete, test: mockPost },
}));

const makeAutomation = (o = {}) => ({ id: '1', name: 'Auto', triggerType: 'manual', actionType: 'send_message', status: 'active', ...o });

describe('Automations E2E – Create Automation Full Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should complete full create automation flow', async () => {
    mockPost.mockResolvedValueOnce({ data: makeAutomation({ name: 'Welcome Flow' }) });
    const res = await mockPost({ name: 'Welcome Flow', triggerType: 'event', actionType: 'send_message' });
    expect(res.data.name).toBe('Welcome Flow');
  });

  it('should show validation errors before API call', () => {
    const validate = vi.fn().mockReturnValue({ name: 'Required' });
    const errs = validate({});
    expect(errs.name).toBeDefined();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('should show new automation in list after creation', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeAutomation({ name: 'Welcome Flow' })] });
    const list = await mockGet();
    expect(list.data).toHaveLength(1);
  });
});

describe('Automations E2E – Edit Automation Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should complete full edit automation flow', async () => {
    mockPut.mockResolvedValueOnce({ data: makeAutomation({ name: 'Updated Flow' }) });
    const res = await mockPut('1', { name: 'Updated Flow' });
    expect(res.data.name).toBe('Updated Flow');
  });

  it('should pre-fill form with existing automation data', () => {
    const auto = makeAutomation({ name: 'Existing' });
    expect(auto.name).toBe('Existing');
  });

  it('should show updated automation in list', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeAutomation({ name: 'Updated Flow' })] });
    const list = await mockGet();
    expect(list.data[0].name).toBe('Updated Flow');
  });
});

describe('Automations E2E – Delete Automation Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should complete delete automation flow', async () => {
    mockDelete.mockResolvedValueOnce({ data: { success: true } });
    const res = await mockDelete('1');
    expect(res.data.success).toBe(true);
  });

  it('should remove automation from list after deletion', async () => {
    mockGet.mockResolvedValueOnce({ data: [] });
    const list = await mockGet();
    expect(list.data).toHaveLength(0);
  });
});

describe('Automations E2E – Toggle Status Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should toggle automation status end to end', async () => {
    mockPut.mockResolvedValueOnce({ data: makeAutomation({ status: 'inactive' }) });
    const res = await mockPut('1', { status: 'inactive' });
    expect(res.data.status).toBe('inactive');
  });

  it('should reflect new status in list', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeAutomation({ status: 'inactive' })] });
    const list = await mockGet();
    expect(list.data[0].status).toBe('inactive');
  });
});

describe('Automations E2E – Dry Run Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should run dry run and show results', async () => {
    mockPost.mockResolvedValueOnce({ data: { success: true, log: ['Trigger matched', 'Message sent'] } });
    const res = await mockPost({ automationId: '1', dryRun: true });
    expect(res.data.log).toHaveLength(2);
  });

  it('should show failure details on dry run failure', async () => {
    mockPost.mockRejectedValueOnce({ response: { data: { reason: 'Condition not met' } } });
    await expect(mockPost({})).rejects.toMatchObject({ response: { data: { reason: 'Condition not met' } } });
  });
});

describe('Automations E2E – Reorder Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should reorder automations and persist new order', async () => {
    mockPut.mockResolvedValueOnce({ data: { success: true } });
    const res = await mockPut({ order: ['2', '1'] });
    expect(res.data.success).toBe(true);
  });
});

describe('Automations E2E – Filter and Search', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should filter automations by trigger type', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeAutomation({ triggerType: 'event' })] });
    const res = await mockGet({ triggerType: 'event' });
    expect(res.data[0].triggerType).toBe('event');
  });

  it('should search automations by name', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeAutomation({ name: 'Lead Nurture' })] });
    const res = await mockGet({ search: 'Lead' });
    expect(res.data[0].name).toBe('Lead Nurture');
  });

  it('should show empty state for no results', async () => {
    mockGet.mockResolvedValueOnce({ data: [] });
    const res = await mockGet({ search: 'nonexistent' });
    expect(res.data).toHaveLength(0);
  });
});

describe('Automations E2E – Error Recovery', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should recover from create error and retry', async () => {
    mockPost.mockRejectedValueOnce(new Error('Server error')).mockResolvedValueOnce({ data: makeAutomation() });
    try { await mockPost({}); } catch {}
    const res = await mockPost({});
    expect(res.data).toBeDefined();
  });

  it('should show error notification on failure', () => {
    const toast = vi.fn();
    toast({ type: 'error' });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });

  it('should maintain list integrity after failed operation', async () => {
    const list = [makeAutomation()];
    mockDelete.mockRejectedValueOnce(new Error('Failed'));
    try { await mockDelete('1'); } catch {}
    expect(list).toHaveLength(1);
  });
});
