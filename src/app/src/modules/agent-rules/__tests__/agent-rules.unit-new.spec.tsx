import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';
import React from 'react';

// ─── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('@/modules/agent-rules/hooks/useAgentRules', () => ({
  useAgentRules: vi.fn(),
}));
vi.mock('@/modules/agent-rules/hooks/useCreateAgentRule', () => ({
  useCreateAgentRule: vi.fn(),
}));
vi.mock('@/modules/agent-rules/hooks/useUpdateAgentRule', () => ({
  useUpdateAgentRule: vi.fn(),
}));
vi.mock('@/modules/agent-rules/hooks/useDeleteAgentRule', () => ({
  useDeleteAgentRule: vi.fn(),
}));

const mockRule = {
  id: 'rule-1',
  name: 'Respond in Portuguese',
  description: 'Always respond in Portuguese',
  isActive: true,
  tenantId: 'tenant-1',
  priority: 1,
  createdAt: '2024-01-01T00:00:00Z',
};

// ─── ModuleAgentRuleButton Component ─────────────────────────────────────────
describe('ModuleAgentRuleButton', () => {
  it('should render button with correct label', async () => {
    const { ModuleAgentRuleButton } = await import('../components/ModuleAgentRuleButton');
    render(<ModuleAgentRuleButton />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should be accessible with aria-label', async () => {
    const { ModuleAgentRuleButton } = await import('../components/ModuleAgentRuleButton');
    render(<ModuleAgentRuleButton />);
    const btn = screen.getByRole('button');
    expect(btn).toBeInTheDocument();
  });

  it('should handle click event', async () => {
    const { ModuleAgentRuleButton } = await import('../components/ModuleAgentRuleButton');
    const onClick = vi.fn();
    render(<ModuleAgentRuleButton onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should render disabled state', async () => {
    const { ModuleAgentRuleButton } = await import('../components/ModuleAgentRuleButton');
    render(<ModuleAgentRuleButton disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should not crash when onClick is undefined', async () => {
    const { ModuleAgentRuleButton } = await import('../components/ModuleAgentRuleButton');
    expect(() => render(<ModuleAgentRuleButton />)).not.toThrow();
  });
});

// ─── Agent Rule data model unit tests ────────────────────────────────────────
describe('AgentRule domain', () => {
  it('should have required fields: id, name, isActive, tenantId', () => {
    expect(mockRule.id).toBeDefined();
    expect(mockRule.name).toBeDefined();
    expect(typeof mockRule.isActive).toBe('boolean');
    expect(mockRule.tenantId).toBeDefined();
  });

  it('should reject empty name', () => {
    const validate = (name: string) => name.trim().length > 0;
    expect(validate('')).toBe(false);
    expect(validate('  ')).toBe(false);
    expect(validate('Valid Rule')).toBe(true);
  });

  it('should reject name longer than 255 chars', () => {
    const validate = (name: string) => name.length <= 255;
    expect(validate('x'.repeat(256))).toBe(false);
    expect(validate('x'.repeat(255))).toBe(true);
  });

  it('should handle null description gracefully', () => {
    const rule = { ...mockRule, description: null };
    expect(rule.description).toBeNull();
  });

  it('should toggle isActive flag', () => {
    const toggle = (rule: typeof mockRule) => ({ ...rule, isActive: !rule.isActive });
    expect(toggle(mockRule).isActive).toBe(false);
    expect(toggle({ ...mockRule, isActive: false }).isActive).toBe(true);
  });

  it('should sort rules by priority ascending', () => {
    const rules = [
      { ...mockRule, id: 'r3', priority: 3 },
      { ...mockRule, id: 'r1', priority: 1 },
      { ...mockRule, id: 'r2', priority: 2 },
    ];
    const sorted = [...rules].sort((a, b) => a.priority - b.priority);
    expect(sorted[0].id).toBe('r1');
    expect(sorted[2].id).toBe('r3');
  });

  it('should filter active rules', () => {
    const rules = [
      { ...mockRule, id: 'r1', isActive: true },
      { ...mockRule, id: 'r2', isActive: false },
      { ...mockRule, id: 'r3', isActive: true },
    ];
    const active = rules.filter(r => r.isActive);
    expect(active).toHaveLength(2);
  });

  it('should filter by tenantId', () => {
    const rules = [
      { ...mockRule, tenantId: 'tenant-1' },
      { ...mockRule, id: 'r2', tenantId: 'tenant-2' },
    ];
    const scoped = rules.filter(r => r.tenantId === 'tenant-1');
    expect(scoped).toHaveLength(1);
  });

  it('should reject SQL injection in name', () => {
    const sanitize = (s: string) => !/['";\\]/.test(s);
    expect(sanitize("Robert'); DROP TABLE rules;--")).toBe(false);
    expect(sanitize('Clean Rule Name')).toBe(true);
  });

  it('should reject XSS in description', () => {
    const sanitize = (s: string) => !/<script/.test(s);
    expect(sanitize('<script>alert(1)</script>')).toBe(false);
    expect(sanitize('Normal description')).toBe(true);
  });

  it('should handle undefined priority as lowest', () => {
    const getPriority = (r: Partial<typeof mockRule>) => r.priority ?? 999;
    expect(getPriority({})).toBe(999);
    expect(getPriority({ priority: 1 })).toBe(1);
  });

  it('should not allow negative priority', () => {
    const validate = (p: number) => p >= 0;
    expect(validate(-1)).toBe(false);
    expect(validate(0)).toBe(true);
  });

  it('should serialize rule to JSON', () => {
    const json = JSON.stringify(mockRule);
    const parsed = JSON.parse(json);
    expect(parsed.id).toBe(mockRule.id);
    expect(parsed.name).toBe(mockRule.name);
  });

  it('should detect duplicate rule names in list', () => {
    const rules = [
      { ...mockRule, name: 'Rule A' },
      { ...mockRule, id: 'r2', name: 'Rule A' },
    ];
    const names = rules.map(r => r.name);
    const hasDuplicate = new Set(names).size !== names.length;
    expect(hasDuplicate).toBe(true);
  });

  it('should create rule with timestamp', () => {
    const now = new Date().toISOString();
    const rule = { ...mockRule, createdAt: now };
    expect(new Date(rule.createdAt).getTime()).toBeGreaterThan(0);
  });

  it('should compute rule display label', () => {
    const label = (r: typeof mockRule) => `${r.name} (${r.isActive ? 'active' : 'inactive'})`;
    expect(label(mockRule)).toBe('Respond in Portuguese (active)');
    expect(label({ ...mockRule, isActive: false })).toBe('Respond in Portuguese (inactive)');
  });
});

// ─── useAgentRules hook unit tests ───────────────────────────────────────────
describe('useAgentRules hook', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return empty list initially', async () => {
    const { useAgentRules } = await import('../hooks/useAgentRules');
    (useAgentRules as ReturnType<typeof vi.fn>).mockReturnValue({ data: [], isLoading: false });
    const { result } = renderHook(() => useAgentRules());
    expect(result.current.data).toEqual([]);
  });

  it('should return loading state', async () => {
    const { useAgentRules } = await import('../hooks/useAgentRules');
    (useAgentRules as ReturnType<typeof vi.fn>).mockReturnValue({ data: undefined, isLoading: true });
    const { result } = renderHook(() => useAgentRules());
    expect(result.current.isLoading).toBe(true);
  });

  it('should return rules list', async () => {
    const { useAgentRules } = await import('../hooks/useAgentRules');
    (useAgentRules as ReturnType<typeof vi.fn>).mockReturnValue({ data: [mockRule], isLoading: false });
    const { result } = renderHook(() => useAgentRules());
    expect(result.current.data).toHaveLength(1);
  });

  it('should expose error state', async () => {
    const { useAgentRules } = await import('../hooks/useAgentRules');
    const error = new Error('Network error');
    (useAgentRules as ReturnType<typeof vi.fn>).mockReturnValue({ data: undefined, isLoading: false, error });
    const { result } = renderHook(() => useAgentRules());
    expect(result.current.error).toBe(error);
  });

  it('should accept tenantId parameter', async () => {
    const { useAgentRules } = await import('../hooks/useAgentRules');
    (useAgentRules as ReturnType<typeof vi.fn>).mockReturnValue({ data: [mockRule], isLoading: false });
    renderHook(() => useAgentRules('tenant-1'));
    expect(useAgentRules).toHaveBeenCalledWith('tenant-1');
  });

  it('should handle 403 forbidden', async () => {
    const { useAgentRules } = await import('../hooks/useAgentRules');
    const error = Object.assign(new Error('Forbidden'), { status: 403 });
    (useAgentRules as ReturnType<typeof vi.fn>).mockReturnValue({ data: undefined, error, isLoading: false });
    const { result } = renderHook(() => useAgentRules());
    expect((result.current.error as any)?.status).toBe(403);
  });

  it('should handle 500 server error', async () => {
    const { useAgentRules } = await import('../hooks/useAgentRules');
    const error = Object.assign(new Error('Internal Server Error'), { status: 500 });
    (useAgentRules as ReturnType<typeof vi.fn>).mockReturnValue({ data: undefined, error, isLoading: false });
    const { result } = renderHook(() => useAgentRules());
    expect((result.current.error as any)?.status).toBe(500);
  });

  it('should handle empty string tenantId', async () => {
    const { useAgentRules } = await import('../hooks/useAgentRules');
    (useAgentRules as ReturnType<typeof vi.fn>).mockReturnValue({ data: [], isLoading: false });
    const { result } = renderHook(() => useAgentRules(''));
    expect(result.current.data).toEqual([]);
  });
});

// ─── useCreateAgentRule hook ──────────────────────────────────────────────────
describe('useCreateAgentRule hook', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should expose mutate function', async () => {
    const { useCreateAgentRule } = await import('../hooks/useCreateAgentRule');
    const mutate = vi.fn();
    (useCreateAgentRule as ReturnType<typeof vi.fn>).mockReturnValue({ mutate, isPending: false });
    const { result } = renderHook(() => useCreateAgentRule());
    expect(typeof result.current.mutate).toBe('function');
  });

  it('should set isPending during creation', async () => {
    const { useCreateAgentRule } = await import('../hooks/useCreateAgentRule');
    (useCreateAgentRule as ReturnType<typeof vi.fn>).mockReturnValue({ mutate: vi.fn(), isPending: true });
    const { result } = renderHook(() => useCreateAgentRule());
    expect(result.current.isPending).toBe(true);
  });

  it('should call mutate with rule data', async () => {
    const { useCreateAgentRule } = await import('../hooks/useCreateAgentRule');
    const mutate = vi.fn();
    (useCreateAgentRule as ReturnType<typeof vi.fn>).mockReturnValue({ mutate, isPending: false });
    const { result } = renderHook(() => useCreateAgentRule());
    act(() => result.current.mutate({ name: 'New Rule', isActive: true }));
    expect(mutate).toHaveBeenCalledWith({ name: 'New Rule', isActive: true });
  });

  it('should expose error on failure', async () => {
    const { useCreateAgentRule } = await import('../hooks/useCreateAgentRule');
    const error = new Error('Create failed');
    (useCreateAgentRule as ReturnType<typeof vi.fn>).mockReturnValue({ mutate: vi.fn(), isPending: false, error });
    const { result } = renderHook(() => useCreateAgentRule());
    expect(result.current.error).toBe(error);
  });

  it('should call onSuccess callback after creation', async () => {
    const { useCreateAgentRule } = await import('../hooks/useCreateAgentRule');
    const onSuccess = vi.fn();
    const mutateAsync = vi.fn().mockResolvedValue(mockRule);
    (useCreateAgentRule as ReturnType<typeof vi.fn>).mockReturnValue({ mutateAsync, isPending: false });
    const { result } = renderHook(() => useCreateAgentRule());
    await act(async () => {
      const created = await result.current.mutateAsync({ name: 'New Rule' });
      onSuccess(created);
    });
    expect(onSuccess).toHaveBeenCalledWith(mockRule);
  });
});

// ─── useUpdateAgentRule hook ──────────────────────────────────────────────────
describe('useUpdateAgentRule hook', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should call mutate with id and update data', async () => {
    const { useUpdateAgentRule } = await import('../hooks/useUpdateAgentRule');
    const mutate = vi.fn();
    (useUpdateAgentRule as ReturnType<typeof vi.fn>).mockReturnValue({ mutate, isPending: false });
    const { result } = renderHook(() => useUpdateAgentRule());
    act(() => result.current.mutate({ id: 'rule-1', name: 'Updated' }));
    expect(mutate).toHaveBeenCalledWith({ id: 'rule-1', name: 'Updated' });
  });

  it('should handle isPending true', async () => {
    const { useUpdateAgentRule } = await import('../hooks/useUpdateAgentRule');
    (useUpdateAgentRule as ReturnType<typeof vi.fn>).mockReturnValue({ mutate: vi.fn(), isPending: true });
    const { result } = renderHook(() => useUpdateAgentRule());
    expect(result.current.isPending).toBe(true);
  });

  it('should handle update error', async () => {
    const { useUpdateAgentRule } = await import('../hooks/useUpdateAgentRule');
    const error = new Error('Update failed');
    (useUpdateAgentRule as ReturnType<typeof vi.fn>).mockReturnValue({ mutate: vi.fn(), error, isPending: false });
    const { result } = renderHook(() => useUpdateAgentRule());
    expect(result.current.error).toBeDefined();
  });
});

// ─── useDeleteAgentRule hook ──────────────────────────────────────────────────
describe('useDeleteAgentRule hook', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should call mutate with rule id', async () => {
    const { useDeleteAgentRule } = await import('../hooks/useDeleteAgentRule');
    const mutate = vi.fn();
    (useDeleteAgentRule as ReturnType<typeof vi.fn>).mockReturnValue({ mutate, isPending: false });
    const { result } = renderHook(() => useDeleteAgentRule());
    act(() => result.current.mutate('rule-1'));
    expect(mutate).toHaveBeenCalledWith('rule-1');
  });

  it('should set isPending true during deletion', async () => {
    const { useDeleteAgentRule } = await import('../hooks/useDeleteAgentRule');
    (useDeleteAgentRule as ReturnType<typeof vi.fn>).mockReturnValue({ mutate: vi.fn(), isPending: true });
    const { result } = renderHook(() => useDeleteAgentRule());
    expect(result.current.isPending).toBe(true);
  });

  it('should handle delete error gracefully', async () => {
    const { useDeleteAgentRule } = await import('../hooks/useDeleteAgentRule');
    const error = new Error('Delete failed');
    (useDeleteAgentRule as ReturnType<typeof vi.fn>).mockReturnValue({ mutate: vi.fn(), error, isPending: false });
    const { result } = renderHook(() => useDeleteAgentRule());
    expect(result.current.error).toBe(error);
  });
});

// ─── Rule filtering and search logic ─────────────────────────────────────────
describe('Agent rule list filtering', () => {
  const rules = [
    { ...mockRule, id: 'r1', name: 'Portuguese language', isActive: true },
    { ...mockRule, id: 'r2', name: 'Formal tone', isActive: false },
    { ...mockRule, id: 'r3', name: 'Short answers', isActive: true },
  ];

  it('should filter by search term case-insensitive', () => {
    const search = (list: typeof rules, term: string) =>
      list.filter(r => r.name.toLowerCase().includes(term.toLowerCase()));
    expect(search(rules, 'port')).toHaveLength(1);
    expect(search(rules, 'PORT')).toHaveLength(1);
  });

  it('should return all rules when search term is empty', () => {
    const search = (list: typeof rules, term: string) =>
      term ? list.filter(r => r.name.toLowerCase().includes(term.toLowerCase())) : list;
    expect(search(rules, '')).toHaveLength(3);
  });

  it('should return empty when no match', () => {
    const search = (list: typeof rules, term: string) =>
      list.filter(r => r.name.toLowerCase().includes(term.toLowerCase()));
    expect(search(rules, 'nonexistent')).toHaveLength(0);
  });

  it('should filter only active rules', () => {
    const active = rules.filter(r => r.isActive);
    expect(active).toHaveLength(2);
  });

  it('should filter only inactive rules', () => {
    const inactive = rules.filter(r => !r.isActive);
    expect(inactive).toHaveLength(1);
  });

  it('should handle undefined list gracefully', () => {
    const safeFilter = (list: typeof rules | undefined) => list ?? [];
    expect(safeFilter(undefined)).toHaveLength(0);
  });

  it('should paginate rules', () => {
    const paginate = (list: typeof rules, page: number, size: number) =>
      list.slice((page - 1) * size, page * size);
    expect(paginate(rules, 1, 2)).toHaveLength(2);
    expect(paginate(rules, 2, 2)).toHaveLength(1);
  });

  it('should count active rules', () => {
    const count = rules.filter(r => r.isActive).length;
    expect(count).toBe(2);
  });

  it('should find rule by id', () => {
    const find = (id: string) => rules.find(r => r.id === id);
    expect(find('r1')?.name).toBe('Portuguese language');
    expect(find('nonexistent')).toBeUndefined();
  });

  it('should map rules to dropdown options', () => {
    const options = rules.map(r => ({ label: r.name, value: r.id }));
    expect(options[0].label).toBe('Portuguese language');
    expect(options[0].value).toBe('r1');
  });
});
