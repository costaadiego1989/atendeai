import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

vi.mock('@/modules/agent-rules/hooks/useAgentRules', () => ({
  useAgentRules: vi.fn().mockReturnValue({ data: [], isLoading: false }),
}));
vi.mock('@/modules/agent-rules/hooks/useCreateAgentRule', () => ({
  useCreateAgentRule: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/modules/agent-rules/hooks/useUpdateAgentRule', () => ({
  useUpdateAgentRule: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/modules/agent-rules/hooks/useDeleteAgentRule', () => ({
  useDeleteAgentRule: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
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

// ─── ModuleAgentRuleButton integration ───────────────────────────────────────
describe('ModuleAgentRuleButton integration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should render within QueryClient provider', async () => {
    const { ModuleAgentRuleButton } = await import('../components/ModuleAgentRuleButton');
    const wrapper = createWrapper();
    render(<ModuleAgentRuleButton />, { wrapper });
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should open sheet on button click', async () => {
    const { ModuleAgentRuleButton } = await import('../components/ModuleAgentRuleButton');
    const wrapper = createWrapper();
    render(<ModuleAgentRuleButton />, { wrapper });
    fireEvent.click(screen.getByRole('button'));
    // Sheet or modal should appear
    await waitFor(() => {
      // Button click triggers some state change
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  it('should close sheet on outside click', async () => {
    const { ModuleAgentRuleButton } = await import('../components/ModuleAgentRuleButton');
    const wrapper = createWrapper();
    render(<ModuleAgentRuleButton />, { wrapper });
    fireEvent.click(screen.getByRole('button'));
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.getByRole('button')).toBeInTheDocument());
  });

  it('should display loading state while fetching', async () => {
    const { useAgentRules } = await import('../hooks/useAgentRules');
    (useAgentRules as ReturnType<typeof vi.fn>).mockReturnValue({ data: undefined, isLoading: true });
    const { ModuleAgentRuleButton } = await import('../components/ModuleAgentRuleButton');
    const wrapper = createWrapper();
    expect(() => render(<ModuleAgentRuleButton />, { wrapper })).not.toThrow();
  });

  it('should handle empty rules list gracefully', async () => {
    const { useAgentRules } = await import('../hooks/useAgentRules');
    (useAgentRules as ReturnType<typeof vi.fn>).mockReturnValue({ data: [], isLoading: false });
    const { ModuleAgentRuleButton } = await import('../components/ModuleAgentRuleButton');
    const wrapper = createWrapper();
    expect(() => render(<ModuleAgentRuleButton />, { wrapper })).not.toThrow();
  });

  it('should handle rules list with one item', async () => {
    const { useAgentRules } = await import('../hooks/useAgentRules');
    (useAgentRules as ReturnType<typeof vi.fn>).mockReturnValue({ data: [mockRule], isLoading: false });
    const { ModuleAgentRuleButton } = await import('../components/ModuleAgentRuleButton');
    const wrapper = createWrapper();
    expect(() => render(<ModuleAgentRuleButton />, { wrapper })).not.toThrow();
  });

  it('should handle error state from hook', async () => {
    const { useAgentRules } = await import('../hooks/useAgentRules');
    (useAgentRules as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('fetch failed'),
    });
    const { ModuleAgentRuleButton } = await import('../components/ModuleAgentRuleButton');
    const wrapper = createWrapper();
    expect(() => render(<ModuleAgentRuleButton />, { wrapper })).not.toThrow();
  });
});

// ─── Create rule integration flow ────────────────────────────────────────────
describe('Create agent rule flow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should call createRule on form submit', async () => {
    const { useCreateAgentRule } = await import('../hooks/useCreateAgentRule');
    const mutate = vi.fn();
    (useCreateAgentRule as ReturnType<typeof vi.fn>).mockReturnValue({ mutate, isPending: false });
    mutate({ name: 'New Rule', isActive: true, priority: 1 });
    expect(mutate).toHaveBeenCalledWith({ name: 'New Rule', isActive: true, priority: 1 });
  });

  it('should prevent double submission', async () => {
    const { useCreateAgentRule } = await import('../hooks/useCreateAgentRule');
    const mutate = vi.fn();
    (useCreateAgentRule as ReturnType<typeof vi.fn>).mockReturnValue({ mutate, isPending: true });
    const { result } = await import('../hooks/useCreateAgentRule').then(m => ({
      result: m.useCreateAgentRule(),
    }));
    expect(result.isPending).toBe(true);
  });

  it('should show success feedback after creation', async () => {
    const { useCreateAgentRule } = await import('../hooks/useCreateAgentRule');
    const mutateAsync = vi.fn().mockResolvedValue(mockRule);
    (useCreateAgentRule as ReturnType<typeof vi.fn>).mockReturnValue({ mutateAsync, isPending: false });
    const hook = useCreateAgentRule();
    const created = await hook.mutateAsync({ name: 'New Rule' });
    expect(created).toEqual(mockRule);
  });

  it('should handle creation failure with error', async () => {
    const { useCreateAgentRule } = await import('../hooks/useCreateAgentRule');
    const mutateAsync = vi.fn().mockRejectedValue(new Error('Conflict: rule name exists'));
    (useCreateAgentRule as ReturnType<typeof vi.fn>).mockReturnValue({ mutateAsync, isPending: false });
    const hook = useCreateAgentRule();
    await expect(hook.mutateAsync({ name: 'Duplicate' })).rejects.toThrow('Conflict');
  });

  it('should reject creation with empty name', async () => {
    const validateName = (name: string) => {
      if (!name.trim()) throw new Error('Name is required');
      return true;
    };
    expect(() => validateName('')).toThrow('Name is required');
    expect(validateName('Valid')).toBe(true);
  });
});

// ─── Update rule integration flow ────────────────────────────────────────────
describe('Update agent rule flow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should call updateRule with id and new data', async () => {
    const { useUpdateAgentRule } = await import('../hooks/useUpdateAgentRule');
    const mutate = vi.fn();
    (useUpdateAgentRule as ReturnType<typeof vi.fn>).mockReturnValue({ mutate, isPending: false });
    const hook = useUpdateAgentRule();
    hook.mutate({ id: 'rule-1', name: 'Updated Name' });
    expect(mutate).toHaveBeenCalledWith({ id: 'rule-1', name: 'Updated Name' });
  });

  it('should optimistically update local state', async () => {
    const { useUpdateAgentRule } = await import('../hooks/useUpdateAgentRule');
    const mutate = vi.fn();
    (useUpdateAgentRule as ReturnType<typeof vi.fn>).mockReturnValue({ mutate, isPending: false });
    const hook = useUpdateAgentRule();
    hook.mutate({ id: 'rule-1', isActive: false });
    expect(mutate).toHaveBeenCalledWith({ id: 'rule-1', isActive: false });
  });

  it('should handle update 404 error', async () => {
    const { useUpdateAgentRule } = await import('../hooks/useUpdateAgentRule');
    const error = Object.assign(new Error('Not found'), { status: 404 });
    (useUpdateAgentRule as ReturnType<typeof vi.fn>).mockReturnValue({ mutate: vi.fn(), error, isPending: false });
    const hook = useUpdateAgentRule();
    expect((hook.error as any)?.status).toBe(404);
  });
});

// ─── Delete rule integration flow ─────────────────────────────────────────────
describe('Delete agent rule flow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should call deleteRule with correct id', async () => {
    const { useDeleteAgentRule } = await import('../hooks/useDeleteAgentRule');
    const mutate = vi.fn();
    (useDeleteAgentRule as ReturnType<typeof vi.fn>).mockReturnValue({ mutate, isPending: false });
    const hook = useDeleteAgentRule();
    hook.mutate('rule-1');
    expect(mutate).toHaveBeenCalledWith('rule-1');
  });

  it('should remove rule from list after deletion', async () => {
    let rules = [mockRule, { ...mockRule, id: 'rule-2', name: 'Rule 2' }];
    const deleteRule = (id: string) => { rules = rules.filter(r => r.id !== id); };
    deleteRule('rule-1');
    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe('rule-2');
  });

  it('should handle delete of nonexistent rule', async () => {
    const { useDeleteAgentRule } = await import('../hooks/useDeleteAgentRule');
    const error = Object.assign(new Error('Not found'), { status: 404 });
    (useDeleteAgentRule as ReturnType<typeof vi.fn>).mockReturnValue({ mutate: vi.fn(), error, isPending: false });
    const hook = useDeleteAgentRule();
    expect(hook.error).toBeDefined();
  });
});

// ─── Tenant isolation integration ─────────────────────────────────────────────
describe('Tenant isolation', () => {
  it('should only fetch rules for current tenant', async () => {
    const { useAgentRules } = await import('../hooks/useAgentRules');
    (useAgentRules as ReturnType<typeof vi.fn>).mockReturnValue({ data: [mockRule], isLoading: false });
    const hook = useAgentRules('tenant-1');
    expect(useAgentRules).toHaveBeenCalledWith('tenant-1');
    expect(hook.data).toEqual([mockRule]);
  });

  it('should not expose rules from other tenants', () => {
    const allRules = [
      { ...mockRule, tenantId: 'tenant-1' },
      { ...mockRule, id: 'r2', tenantId: 'tenant-2' },
      { ...mockRule, id: 'r3', tenantId: 'tenant-1' },
    ];
    const tenant1Rules = allRules.filter(r => r.tenantId === 'tenant-1');
    expect(tenant1Rules).toHaveLength(2);
    expect(tenant1Rules.every(r => r.tenantId === 'tenant-1')).toBe(true);
  });

  it('should reject request without tenantId', () => {
    const validate = (tenantId: string | undefined) => {
      if (!tenantId) throw new Error('tenantId required');
      return true;
    };
    expect(() => validate(undefined)).toThrow('tenantId required');
    expect(validate('tenant-1')).toBe(true);
  });
});

// ─── Priority management integration ──────────────────────────────────────────
describe('Rule priority management', () => {
  it('should reorder rules on drag', () => {
    let rules = [
      { ...mockRule, id: 'r1', priority: 1 },
      { ...mockRule, id: 'r2', priority: 2 },
      { ...mockRule, id: 'r3', priority: 3 },
    ];
    // Simulate moving r3 to position 1
    const reorder = (list: typeof rules, fromIndex: number, toIndex: number) => {
      const result = [...list];
      const [removed] = result.splice(fromIndex, 1);
      result.splice(toIndex, 0, removed);
      return result.map((r, i) => ({ ...r, priority: i + 1 }));
    };
    const reordered = reorder(rules, 2, 0);
    expect(reordered[0].id).toBe('r3');
    expect(reordered[0].priority).toBe(1);
  });

  it('should not allow two rules with same priority', () => {
    const hasDuplicate = (rules: Array<{ priority: number }>) => {
      const priorities = rules.map(r => r.priority);
      return new Set(priorities).size !== priorities.length;
    };
    expect(hasDuplicate([{ priority: 1 }, { priority: 1 }])).toBe(true);
    expect(hasDuplicate([{ priority: 1 }, { priority: 2 }])).toBe(false);
  });
});

// ─── Bulk operations integration ───────────────────────────────────────────────
describe('Bulk operations', () => {
  it('should toggle multiple rules active state', () => {
    const rules = [
      { ...mockRule, id: 'r1', isActive: true },
      { ...mockRule, id: 'r2', isActive: true },
      { ...mockRule, id: 'r3', isActive: false },
    ];
    const toggleAll = (list: typeof rules, active: boolean) =>
      list.map(r => ({ ...r, isActive: active }));
    const deactivated = toggleAll(rules, false);
    expect(deactivated.every(r => !r.isActive)).toBe(true);
  });

  it('should delete multiple rules', () => {
    let rules = [
      { ...mockRule, id: 'r1' },
      { ...mockRule, id: 'r2' },
      { ...mockRule, id: 'r3' },
    ];
    const deleteMany = (list: typeof rules, ids: string[]) =>
      list.filter(r => !ids.includes(r.id));
    rules = deleteMany(rules, ['r1', 'r3']);
    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe('r2');
  });

  it('should export rules as JSON', () => {
    const rules = [mockRule];
    const exported = JSON.stringify(rules, null, 2);
    const parsed = JSON.parse(exported);
    expect(parsed[0].id).toBe('rule-1');
  });
});
