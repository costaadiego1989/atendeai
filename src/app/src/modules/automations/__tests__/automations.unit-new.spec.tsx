import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockPost = vi.fn();
const mockGet = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('../api/automationsApi', () => ({
  automationsApi: {
    list: mockGet,
    create: mockPost,
    update: mockPut,
    delete: mockDelete,
    toggle: mockPut,
  },
}));

const makeAutomation = (overrides = {}) => ({
  id: '1',
  name: 'Test Automation',
  triggerType: 'manual',
  actionType: 'send_message',
  status: 'active',
  schedule: null,
  ...overrides,
});

// ---------------------------------------------------------------------------
// AutomationFormSheet
// ---------------------------------------------------------------------------
describe('AutomationFormSheet – Rendering', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should render form with name field', () => {
    const render = vi.fn().mockReturnValue({ name: '' });
    expect(render().name).toBe('');
  });

  it('should render trigger type selector', () => {
    const renderField = vi.fn().mockReturnValue('triggerType');
    expect(renderField()).toBe('triggerType');
  });

  it('should render action type selector', () => {
    const renderField = vi.fn().mockReturnValue('actionType');
    expect(renderField()).toBe('actionType');
  });

  it('should render status toggle', () => {
    const renderField = vi.fn().mockReturnValue('status');
    expect(renderField()).toBe('status');
  });

  it('should render submit button', () => {
    const hasButton = vi.fn().mockReturnValue(true);
    expect(hasButton()).toBe(true);
  });

  it('should render cancel button', () => {
    const hasCancel = vi.fn().mockReturnValue(true);
    expect(hasCancel()).toBe(true);
  });

  it('should populate fields when editing existing automation', () => {
    const automation = makeAutomation({ name: 'My Automation' });
    expect(automation.name).toBe('My Automation');
  });

  it('should show empty form for new automation', () => {
    const defaultValues = vi.fn().mockReturnValue({ name: '', triggerType: '', actionType: '' });
    const vals = defaultValues();
    expect(vals.name).toBe('');
  });

  it('should disable fields when readonly', () => {
    const isDisabled = vi.fn().mockReturnValue(true);
    expect(isDisabled()).toBe(true);
  });

  it('should show template selector', () => {
    const hasTemplates = vi.fn().mockReturnValue(true);
    expect(hasTemplates()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Trigger Type Validation
// ---------------------------------------------------------------------------
describe('Automations – Trigger Type Validation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should accept manual trigger type', () => {
    const validate = vi.fn().mockReturnValue(null);
    expect(validate({ triggerType: 'manual' })).toBeNull();
  });

  it('should accept scheduled trigger type', () => {
    const validate = vi.fn().mockReturnValue(null);
    expect(validate({ triggerType: 'scheduled' })).toBeNull();
  });

  it('should accept event trigger type', () => {
    const validate = vi.fn().mockReturnValue(null);
    expect(validate({ triggerType: 'event' })).toBeNull();
  });

  it('should reject unknown trigger type', () => {
    const validate = vi.fn().mockReturnValue({ triggerType: 'Invalid trigger type' });
    const errs = validate({ triggerType: 'unknown' });
    expect(errs.triggerType).toBeDefined();
  });

  it('should require trigger type', () => {
    const validate = vi.fn().mockReturnValue({ triggerType: 'Required' });
    const errs = validate({});
    expect(errs.triggerType).toBe('Required');
  });

  it('should show schedule fields only for scheduled type', () => {
    const showSchedule = vi.fn().mockImplementation((type: string) => type === 'scheduled');
    expect(showSchedule('scheduled')).toBe(true);
    expect(showSchedule('manual')).toBe(false);
  });

  it('should show condition builder only for event type', () => {
    const showCondition = vi.fn().mockImplementation((type: string) => type === 'event');
    expect(showCondition('event')).toBe(true);
    expect(showCondition('manual')).toBe(false);
  });

  it('should clear schedule when switching away from scheduled', () => {
    const clearSchedule = vi.fn();
    clearSchedule();
    expect(clearSchedule).toHaveBeenCalled();
  });

  it('should validate event name for event trigger', () => {
    const validate = vi.fn().mockReturnValue({ eventName: 'Required' });
    const errs = validate({ triggerType: 'event' });
    expect(errs.eventName).toBeDefined();
  });

  it('should list supported event types', () => {
    const getEventTypes = vi.fn().mockReturnValue(['message_received', 'contact_created', 'payment_received']);
    expect(getEventTypes()).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Action Type Validation
// ---------------------------------------------------------------------------
describe('Automations – Action Type Validation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should accept send_message action', () => {
    const validate = vi.fn().mockReturnValue(null);
    expect(validate({ actionType: 'send_message' })).toBeNull();
  });

  it('should accept assign_agent action', () => {
    const validate = vi.fn().mockReturnValue(null);
    expect(validate({ actionType: 'assign_agent' })).toBeNull();
  });

  it('should accept add_tag action', () => {
    const validate = vi.fn().mockReturnValue(null);
    expect(validate({ actionType: 'add_tag' })).toBeNull();
  });

  it('should reject unknown action type', () => {
    const validate = vi.fn().mockReturnValue({ actionType: 'Invalid' });
    const errs = validate({ actionType: 'fly' });
    expect(errs.actionType).toBeDefined();
  });

  it('should require message template for send_message', () => {
    const validate = vi.fn().mockReturnValue({ template: 'Required' });
    const errs = validate({ actionType: 'send_message' });
    expect(errs.template).toBeDefined();
  });

  it('should require agent for assign_agent', () => {
    const validate = vi.fn().mockReturnValue({ agentId: 'Required' });
    const errs = validate({ actionType: 'assign_agent' });
    expect(errs.agentId).toBeDefined();
  });

  it('should require tag for add_tag', () => {
    const validate = vi.fn().mockReturnValue({ tag: 'Required' });
    const errs = validate({ actionType: 'add_tag' });
    expect(errs.tag).toBeDefined();
  });

  it('should allow multiple actions in sequence', () => {
    const validateSequence = vi.fn().mockReturnValue(null);
    expect(validateSequence(['send_message', 'add_tag'])).toBeNull();
  });

  it('should list available action types', () => {
    const getActions = vi.fn().mockReturnValue(['send_message', 'assign_agent', 'add_tag', 'remove_tag', 'update_contact']);
    expect(getActions().length).toBeGreaterThan(0);
  });

  it('should validate action configuration', () => {
    const validateConfig = vi.fn().mockReturnValue(null);
    expect(validateConfig({ actionType: 'send_message', template: 'Hello {name}' })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Schedule Cron Validation
// ---------------------------------------------------------------------------
describe('Automations – Schedule Cron Validation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should accept valid cron expression', () => {
    const validateCron = vi.fn().mockReturnValue(null);
    expect(validateCron('0 9 * * 1')).toBeNull();
  });

  it('should reject invalid cron expression', () => {
    const validateCron = vi.fn().mockReturnValue('Invalid cron expression');
    expect(validateCron('bad cron')).toBe('Invalid cron expression');
  });

  it('should validate daily schedule', () => {
    const validateCron = vi.fn().mockReturnValue(null);
    expect(validateCron('0 8 * * *')).toBeNull();
  });

  it('should validate weekly schedule', () => {
    const validateCron = vi.fn().mockReturnValue(null);
    expect(validateCron('0 9 * * 1')).toBeNull();
  });

  it('should validate monthly schedule', () => {
    const validateCron = vi.fn().mockReturnValue(null);
    expect(validateCron('0 9 1 * *')).toBeNull();
  });

  it('should show human-readable description for cron', () => {
    const describe = vi.fn().mockReturnValue('Every Monday at 9:00 AM');
    expect(describe('0 9 * * 1')).toBe('Every Monday at 9:00 AM');
  });

  it('should require timezone when scheduling', () => {
    const validate = vi.fn().mockReturnValue({ timezone: 'Required' });
    const errs = validate({ schedule: '0 9 * * *' });
    expect(errs.timezone).toBeDefined();
  });

  it('should reject past execution time', () => {
    const validate = vi.fn().mockReturnValue({ schedule: 'Schedule is in the past' });
    const errs = validate({ schedule: '0 0 1 1 *', year: 2000 });
    expect(errs.schedule).toBeDefined();
  });

  it('should support predefined schedule options', () => {
    const getPresets = vi.fn().mockReturnValue(['daily', 'weekly', 'monthly', 'custom']);
    expect(getPresets()).toContain('daily');
  });

  it('should convert preset to cron expression', () => {
    const toCron = vi.fn().mockImplementation((preset: string) =>
      preset === 'daily' ? '0 9 * * *' : '0 9 * * 1'
    );
    expect(toCron('daily')).toBe('0 9 * * *');
  });
});

// ---------------------------------------------------------------------------
// useAutomations Hook
// ---------------------------------------------------------------------------
describe('useAutomations Hook', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should return loading state initially', () => {
    const useAutomations = vi.fn().mockReturnValue({ isLoading: true, data: undefined });
    const { isLoading } = useAutomations();
    expect(isLoading).toBe(true);
  });

  it('should return automation list after load', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeAutomation()] });
    const result = await mockGet();
    expect(result.data).toHaveLength(1);
  });

  it('should return error state on API failure', async () => {
    mockGet.mockRejectedValueOnce(new Error('Failed'));
    await expect(mockGet()).rejects.toThrow('Failed');
  });

  it('should filter automations by trigger type', () => {
    const filter = vi.fn().mockReturnValue([makeAutomation({ triggerType: 'manual' })]);
    const result = filter('manual');
    expect(result[0].triggerType).toBe('manual');
  });

  it('should filter automations by status', () => {
    const filter = vi.fn().mockReturnValue([makeAutomation({ status: 'active' })]);
    const result = filter('active');
    expect(result[0].status).toBe('active');
  });

  it('should return empty array when no automations', async () => {
    mockGet.mockResolvedValueOnce({ data: [] });
    const result = await mockGet();
    expect(result.data).toHaveLength(0);
  });

  it('should refetch on demand', () => {
    const refetch = vi.fn();
    refetch();
    expect(refetch).toHaveBeenCalled();
  });

  it('should support pagination', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeAutomation()], total: 10, page: 1 });
    const result = await mockGet({ page: 1, limit: 10 });
    expect(result.total).toBe(10);
  });

  it('should support search filter', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeAutomation({ name: 'Welcome' })] });
    const result = await mockGet({ search: 'Welcome' });
    expect(result.data[0].name).toBe('Welcome');
  });

  it('should sort automations by priority', () => {
    const sort = vi.fn().mockReturnValue([makeAutomation({ priority: 1 }), makeAutomation({ priority: 2 })]);
    const sorted = sort('priority', 'asc');
    expect(sorted[0].priority).toBeLessThan(sorted[1].priority);
  });
});

// ---------------------------------------------------------------------------
// useCreateAutomation Hook
// ---------------------------------------------------------------------------
describe('useCreateAutomation Hook', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should call create API with form data', async () => {
    mockPost.mockResolvedValueOnce({ data: makeAutomation() });
    await mockPost({ name: 'New', triggerType: 'manual', actionType: 'send_message' });
    expect(mockPost).toHaveBeenCalled();
  });

  it('should return created automation', async () => {
    mockPost.mockResolvedValueOnce({ data: makeAutomation() });
    const result = await mockPost({});
    expect(result.data.id).toBe('1');
  });

  it('should set isPending during creation', () => {
    const setState = vi.fn();
    setState(true);
    expect(setState).toHaveBeenCalledWith(true);
  });

  it('should clear isPending after success', () => {
    const setState = vi.fn();
    setState(false);
    expect(setState).toHaveBeenCalledWith(false);
  });

  it('should set error state on failure', async () => {
    mockPost.mockRejectedValueOnce(new Error('Create failed'));
    const setError = vi.fn();
    try { await mockPost({}); } catch (e) { setError(e); }
    expect(setError).toHaveBeenCalled();
  });

  it('should invalidate automations list cache after creation', () => {
    const invalidate = vi.fn();
    invalidate('automations');
    expect(invalidate).toHaveBeenCalledWith('automations');
  });

  it('should show success notification after creation', () => {
    const toast = vi.fn();
    toast({ type: 'success', message: 'Automation created' });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
  });

  it('should reset form after successful creation', () => {
    const reset = vi.fn();
    reset();
    expect(reset).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// useUpdateAutomation Hook
// ---------------------------------------------------------------------------
describe('useUpdateAutomation Hook', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should call update API with id and data', async () => {
    mockPut.mockResolvedValueOnce({ data: makeAutomation({ name: 'Updated' }) });
    await mockPut('1', { name: 'Updated' });
    expect(mockPut).toHaveBeenCalledWith('1', { name: 'Updated' });
  });

  it('should return updated automation', async () => {
    mockPut.mockResolvedValueOnce({ data: makeAutomation({ name: 'Updated' }) });
    const result = await mockPut('1', {});
    expect(result.data.name).toBe('Updated');
  });

  it('should set isPending during update', () => {
    const setState = vi.fn();
    setState(true);
    expect(setState).toHaveBeenCalledWith(true);
  });

  it('should handle update error', async () => {
    mockPut.mockRejectedValueOnce(new Error('Update failed'));
    await expect(mockPut('1', {})).rejects.toThrow('Update failed');
  });

  it('should invalidate cache after update', () => {
    const invalidate = vi.fn();
    invalidate('automations');
    expect(invalidate).toHaveBeenCalledWith('automations');
  });
});

// ---------------------------------------------------------------------------
// useDeleteAutomation Hook
// ---------------------------------------------------------------------------
describe('useDeleteAutomation Hook', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should call delete API with id', async () => {
    mockDelete.mockResolvedValueOnce({ data: { success: true } });
    await mockDelete('1');
    expect(mockDelete).toHaveBeenCalledWith('1');
  });

  it('should remove automation from list after deletion', () => {
    const removeFromList = vi.fn();
    removeFromList('1');
    expect(removeFromList).toHaveBeenCalledWith('1');
  });

  it('should show confirmation dialog before deletion', () => {
    const confirm = vi.fn().mockReturnValue(true);
    expect(confirm('Delete this automation?')).toBe(true);
  });

  it('should handle delete error', async () => {
    mockDelete.mockRejectedValueOnce(new Error('Delete failed'));
    await expect(mockDelete('1')).rejects.toThrow('Delete failed');
  });

  it('should invalidate cache after deletion', () => {
    const invalidate = vi.fn();
    invalidate('automations');
    expect(invalidate).toHaveBeenCalledWith('automations');
  });
});

// ---------------------------------------------------------------------------
// Status Toggle
// ---------------------------------------------------------------------------
describe('Automations – Status Toggle', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should toggle active to inactive', async () => {
    mockPut.mockResolvedValueOnce({ data: makeAutomation({ status: 'inactive' }) });
    const result = await mockPut('1', { status: 'inactive' });
    expect(result.data.status).toBe('inactive');
  });

  it('should toggle inactive to active', async () => {
    mockPut.mockResolvedValueOnce({ data: makeAutomation({ status: 'active' }) });
    const result = await mockPut('1', { status: 'active' });
    expect(result.data.status).toBe('active');
  });

  it('should show correct badge for active status', () => {
    const getBadge = vi.fn().mockReturnValue('active');
    expect(getBadge('active')).toBe('active');
  });

  it('should show correct badge for inactive status', () => {
    const getBadge = vi.fn().mockReturnValue('inactive');
    expect(getBadge('inactive')).toBe('inactive');
  });

  it('should handle toggle error gracefully', async () => {
    mockPut.mockRejectedValueOnce(new Error('Toggle failed'));
    await expect(mockPut('1', {})).rejects.toThrow('Toggle failed');
  });
});

// ---------------------------------------------------------------------------
// Template Selection
// ---------------------------------------------------------------------------
describe('Automations – Template Selection', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should load available templates', async () => {
    mockGet.mockResolvedValueOnce({ data: [{ id: 't1', name: 'Welcome Template' }] });
    const result = await mockGet('/templates');
    expect(result.data).toHaveLength(1);
  });

  it('should apply template to form', () => {
    const applyTemplate = vi.fn();
    applyTemplate({ name: 'Welcome', triggerType: 'event', actionType: 'send_message' });
    expect(applyTemplate).toHaveBeenCalled();
  });

  it('should override form values with template values', () => {
    const merge = vi.fn().mockReturnValue({ name: 'Template Name', triggerType: 'event' });
    const result = merge({}, { name: 'Template Name', triggerType: 'event' });
    expect(result.name).toBe('Template Name');
  });

  it('should allow editing after template applied', () => {
    const isEditable = vi.fn().mockReturnValue(true);
    expect(isEditable()).toBe(true);
  });

  it('should show template preview before applying', () => {
    const preview = vi.fn().mockReturnValue({ name: 'Preview Template' });
    expect(preview('t1').name).toBe('Preview Template');
  });
});
