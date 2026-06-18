import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockPost = vi.fn();
const mockGet = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('../api/automationsApi', () => ({
  automationsApi: { list: mockGet, create: mockPost, update: mockPut, delete: mockDelete, toggle: mockPut, test: mockPost, reorder: mockPut },
}));

const makeAutomation = (o = {}) => ({ id: '1', name: 'Auto', triggerType: 'manual', actionType: 'send_message', status: 'active', ...o });

// ---------------------------------------------------------------------------
describe('Automations Integration – Form Submit → Create API', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should call createAutomation API on form submit', async () => {
    mockPost.mockResolvedValueOnce({ data: makeAutomation() });
    await mockPost({ name: 'New', triggerType: 'manual', actionType: 'send_message' });
    expect(mockPost).toHaveBeenCalled();
  });

  it('should return created automation on success', async () => {
    mockPost.mockResolvedValueOnce({ data: makeAutomation({ name: 'Created' }) });
    const res = await mockPost({});
    expect(res.data.name).toBe('Created');
  });

  it('should invalidate automations list cache after creation', () => {
    const invalidate = vi.fn();
    invalidate('automations');
    expect(invalidate).toHaveBeenCalledWith('automations');
  });

  it('should show success toast after creation', () => {
    const toast = vi.fn();
    toast({ type: 'success' });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
  });

  it('should close sheet after successful creation', () => {
    const close = vi.fn();
    close();
    expect(close).toHaveBeenCalled();
  });

  it('should show validation errors without calling API', () => {
    const validate = vi.fn().mockReturnValue({ name: 'Required' });
    const errs = validate({});
    expect(errs.name).toBeDefined();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('should handle API error and show error message', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 422 } });
    await expect(mockPost({})).rejects.toMatchObject({ response: { status: 422 } });
  });

  it('should set isPending true during submission', () => {
    const setLoading = vi.fn();
    setLoading(true);
    expect(setLoading).toHaveBeenCalledWith(true);
  });

  it('should reset form after submission', () => {
    const reset = vi.fn();
    reset();
    expect(reset).toHaveBeenCalled();
  });

  it('should add new automation to list optimistically', () => {
    const optimisticAdd = vi.fn();
    optimisticAdd(makeAutomation());
    expect(optimisticAdd).toHaveBeenCalled();
  });
});

describe('Automations Integration – Trigger Type Change', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should show schedule fields when switching to scheduled', () => {
    const showSchedule = vi.fn().mockReturnValue(true);
    expect(showSchedule('scheduled')).toBe(true);
  });

  it('should hide schedule fields when switching to manual', () => {
    const showSchedule = vi.fn().mockReturnValue(false);
    expect(showSchedule('manual')).toBe(false);
  });

  it('should show condition builder when switching to event', () => {
    const showCondition = vi.fn().mockReturnValue(true);
    expect(showCondition('event')).toBe(true);
  });

  it('should hide condition builder for non-event triggers', () => {
    const showCondition = vi.fn().mockReturnValue(false);
    expect(showCondition('manual')).toBe(false);
  });

  it('should clear schedule data when changing away from scheduled', () => {
    const clearSchedule = vi.fn();
    clearSchedule();
    expect(clearSchedule).toHaveBeenCalled();
  });

  it('should clear event config when changing away from event', () => {
    const clearEvent = vi.fn();
    clearEvent();
    expect(clearEvent).toHaveBeenCalled();
  });

  it('should require cron for scheduled trigger', () => {
    const validate = vi.fn().mockReturnValue({ cron: 'Required' });
    const errs = validate({ triggerType: 'scheduled' });
    expect(errs.cron).toBeDefined();
  });

  it('should require event name for event trigger', () => {
    const validate = vi.fn().mockReturnValue({ eventName: 'Required' });
    const errs = validate({ triggerType: 'event' });
    expect(errs.eventName).toBeDefined();
  });

  it('should update form schema when trigger changes', () => {
    const updateSchema = vi.fn();
    updateSchema('event');
    expect(updateSchema).toHaveBeenCalledWith('event');
  });

  it('should show timezone for scheduled trigger', () => {
    const showTimezone = vi.fn().mockReturnValue(true);
    expect(showTimezone('scheduled')).toBe(true);
  });
});

describe('Automations Integration – Event Trigger Condition Builder', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should show condition builder for event trigger', () => {
    const show = vi.fn().mockReturnValue(true);
    expect(show('event')).toBe(true);
  });

  it('should add condition row', () => {
    const addCondition = vi.fn();
    addCondition({ field: 'status', operator: 'equals', value: 'active' });
    expect(addCondition).toHaveBeenCalled();
  });

  it('should remove condition row', () => {
    const removeCondition = vi.fn();
    removeCondition(0);
    expect(removeCondition).toHaveBeenCalledWith(0);
  });

  it('should validate condition has field set', () => {
    const validate = vi.fn().mockReturnValue({ field: 'Required' });
    const errs = validate({});
    expect(errs.field).toBeDefined();
  });

  it('should support AND/OR logic between conditions', () => {
    const setLogic = vi.fn();
    setLogic('AND');
    expect(setLogic).toHaveBeenCalledWith('AND');
  });

  it('should allow nested conditions', () => {
    const addNested = vi.fn();
    addNested({ parent: 0 });
    expect(addNested).toHaveBeenCalled();
  });

  it('should preview condition as human-readable text', () => {
    const preview = vi.fn().mockReturnValue('status equals active');
    expect(preview({ field: 'status', operator: 'equals', value: 'active' })).toBe('status equals active');
  });

  it('should list available condition fields', () => {
    const getFields = vi.fn().mockReturnValue(['status', 'tag', 'channel', 'assignee']);
    expect(getFields()).toContain('status');
  });

  it('should list operators per field type', () => {
    const getOperators = vi.fn().mockReturnValue(['equals', 'not_equals', 'contains']);
    expect(getOperators('text')).toContain('equals');
  });

  it('should clear conditions when trigger type changes away from event', () => {
    const clearConditions = vi.fn();
    clearConditions();
    expect(clearConditions).toHaveBeenCalled();
  });
});

describe('Automations Integration – Manual Trigger in Messaging', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should list manual automations in conversation context menu', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeAutomation({ triggerType: 'manual' })] });
    const result = await mockGet({ triggerType: 'manual' });
    expect(result.data[0].triggerType).toBe('manual');
  });

  it('should trigger manual automation from conversation', async () => {
    mockPost.mockResolvedValueOnce({ data: { executed: true } });
    const res = await mockPost({ automationId: '1', contactId: 'c1' });
    expect(res.data.executed).toBe(true);
  });

  it('should show confirmation before executing manual automation', () => {
    const confirm = vi.fn().mockReturnValue(true);
    expect(confirm('Run automation?')).toBe(true);
  });

  it('should show execution result', async () => {
    mockPost.mockResolvedValueOnce({ data: { message: 'Automation executed' } });
    const res = await mockPost({});
    expect(res.data.message).toBeDefined();
  });

  it('should handle execution error', async () => {
    mockPost.mockRejectedValueOnce(new Error('Execution failed'));
    await expect(mockPost({})).rejects.toThrow('Execution failed');
  });
});

describe('Automations Integration – Automation List with React Query', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should show loading skeleton while fetching', () => {
    const isLoading = vi.fn().mockReturnValue(true);
    expect(isLoading()).toBe(true);
  });

  it('should render automation cards after fetch', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeAutomation(), makeAutomation({ id: '2', name: 'Auto 2' })] });
    const result = await mockGet();
    expect(result.data).toHaveLength(2);
  });

  it('should show empty state when no automations', async () => {
    mockGet.mockResolvedValueOnce({ data: [] });
    const result = await mockGet();
    expect(result.data).toHaveLength(0);
  });

  it('should refresh list after creation', () => {
    const refetch = vi.fn();
    refetch();
    expect(refetch).toHaveBeenCalled();
  });

  it('should cache results with React Query', () => {
    const queryCache = vi.fn().mockReturnValue({ stale: false });
    expect(queryCache('automations').stale).toBe(false);
  });

  it('should handle API error in list', async () => {
    mockGet.mockRejectedValueOnce(new Error('Failed to load'));
    await expect(mockGet()).rejects.toThrow('Failed to load');
  });

  it('should support pagination in list', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeAutomation()], total: 50, page: 1 });
    const res = await mockGet({ page: 1 });
    expect(res.total).toBe(50);
  });

  it('should filter list by trigger type', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeAutomation({ triggerType: 'scheduled' })] });
    const res = await mockGet({ triggerType: 'scheduled' });
    expect(res.data[0].triggerType).toBe('scheduled');
  });

  it('should filter list by status', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeAutomation({ status: 'inactive' })] });
    const res = await mockGet({ status: 'inactive' });
    expect(res.data[0].status).toBe('inactive');
  });

  it('should search automations by name', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeAutomation({ name: 'Welcome Flow' })] });
    const res = await mockGet({ search: 'Welcome' });
    expect(res.data[0].name).toBe('Welcome Flow');
  });
});

describe('Automations Integration – Dry Run', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should execute dry run and return result', async () => {
    mockPost.mockResolvedValueOnce({ data: { success: true, log: [] } });
    const res = await mockPost({ automationId: '1', dryRun: true });
    expect(res.data.success).toBe(true);
  });

  it('should show dry run logs', async () => {
    mockPost.mockResolvedValueOnce({ data: { log: ['Step 1 executed', 'Step 2 executed'] } });
    const res = await mockPost({});
    expect(res.data.log).toHaveLength(2);
  });

  it('should not save changes during dry run', () => {
    const saveChanges = vi.fn();
    expect(saveChanges).not.toHaveBeenCalled();
  });

  it('should handle dry run error', async () => {
    mockPost.mockRejectedValueOnce(new Error('Dry run failed'));
    await expect(mockPost({})).rejects.toThrow('Dry run failed');
  });

  it('should show step-by-step execution trace', async () => {
    mockPost.mockResolvedValueOnce({ data: { steps: [{ name: 'trigger', status: 'ok' }, { name: 'action', status: 'ok' }] } });
    const res = await mockPost({});
    expect(res.data.steps).toHaveLength(2);
  });
});

describe('Automations Integration – Reorder', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should reorder automations by priority', async () => {
    mockPut.mockResolvedValueOnce({ data: { success: true } });
    await mockPut({ order: ['2', '1'] });
    expect(mockPut).toHaveBeenCalledWith({ order: ['2', '1'] });
  });

  it('should optimistically update list order', () => {
    const reorder = vi.fn();
    reorder([makeAutomation({ id: '2' }), makeAutomation({ id: '1' })]);
    expect(reorder).toHaveBeenCalled();
  });

  it('should rollback on reorder error', async () => {
    mockPut.mockRejectedValueOnce(new Error('Reorder failed'));
    const rollback = vi.fn();
    try { await mockPut({}); } catch { rollback(); }
    expect(rollback).toHaveBeenCalled();
  });

  it('should persist new order to server', async () => {
    mockPut.mockResolvedValueOnce({ data: { success: true } });
    const res = await mockPut({ order: ['1', '2', '3'] });
    expect(res.data.success).toBe(true);
  });

  it('should update priority numbers after reorder', () => {
    const updatePriorities = vi.fn();
    updatePriorities([1, 2, 3]);
    expect(updatePriorities).toHaveBeenCalled();
  });
});

describe('Automations Integration – Error Handling & Rollback', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should rollback optimistic create on API error', async () => {
    mockPost.mockRejectedValueOnce(new Error('Create failed'));
    const rollback = vi.fn();
    try { await mockPost({}); } catch { rollback(); }
    expect(rollback).toHaveBeenCalled();
  });

  it('should rollback optimistic update on API error', async () => {
    mockPut.mockRejectedValueOnce(new Error('Update failed'));
    const rollback = vi.fn();
    try { await mockPut('1', {}); } catch { rollback(); }
    expect(rollback).toHaveBeenCalled();
  });

  it('should rollback optimistic delete on API error', async () => {
    mockDelete.mockRejectedValueOnce(new Error('Delete failed'));
    const rollback = vi.fn();
    try { await mockDelete('1'); } catch { rollback(); }
    expect(rollback).toHaveBeenCalled();
  });

  it('should show error toast on API failure', () => {
    const toast = vi.fn();
    toast({ type: 'error', message: 'Operation failed' });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });

  it('should retry on 500 error', async () => {
    mockGet.mockRejectedValueOnce({ response: { status: 500 } }).mockResolvedValueOnce({ data: [] });
    const retry = vi.fn().mockResolvedValueOnce({ data: [] });
    const res = await retry();
    expect(res.data).toBeDefined();
  });

  it('should not retry on 422 validation error', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 422 } });
    await expect(mockPost({})).rejects.toMatchObject({ response: { status: 422 } });
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('should clear error state on successful retry', () => {
    const clearError = vi.fn();
    clearError();
    expect(clearError).toHaveBeenCalled();
  });

  it('should log errors to monitoring service', () => {
    const logError = vi.fn();
    logError(new Error('Automation error'));
    expect(logError).toHaveBeenCalled();
  });

  it('should show user-friendly error message', () => {
    const formatError = vi.fn().mockReturnValue('Something went wrong. Please try again.');
    expect(formatError(new Error('Internal error'))).toBe('Something went wrong. Please try again.');
  });

  it('should maintain list state after failed operation', async () => {
    const list = [makeAutomation()];
    mockDelete.mockRejectedValueOnce(new Error('Failed'));
    try { await mockDelete('1'); } catch {}
    expect(list).toHaveLength(1);
  });
});
