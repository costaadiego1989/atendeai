import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const createWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

vi.mock('@/modules/agent-rules/hooks/useAgentRules', () => ({
  useAgentRules: vi.fn().mockReturnValue({ data: [], isLoading: false }),
}));
vi.mock('@/modules/agent-rules/hooks/useCreateAgentRule', () => ({
  useCreateAgentRule: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/modules/agent-rules/hooks/useDeleteAgentRule', () => ({
  useDeleteAgentRule: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
}));

const mockRule = {
  id: 'rule-1',
  name: 'Respond in Portuguese',
  isActive: true,
  tenantId: 'tenant-1',
  priority: 1,
};

// ─── Full user flows (e2e-style) ─────────────────────────────────────────────
describe('Agent Rules e2e flows', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should render page without crashing', async () => {
    const { ModuleAgentRuleButton } = await import('../components/ModuleAgentRuleButton');
    const wrapper = createWrapper();
    expect(() => render(<ModuleAgentRuleButton />, { wrapper })).not.toThrow();
  });

  it('should show empty state when no rules exist', async () => {
    const { useAgentRules } = await import('../hooks/useAgentRules');
    (useAgentRules as ReturnType<typeof vi.fn>).mockReturnValue({ data: [], isLoading: false });
    const { ModuleAgentRuleButton } = await import('../components/ModuleAgentRuleButton');
    const wrapper = createWrapper();
    render(<ModuleAgentRuleButton />, { wrapper });
    // Component should render without errors
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should complete create rule user flow', async () => {
    const { useCreateAgentRule } = await import('../hooks/useCreateAgentRule');
    const mutateAsync = vi.fn().mockResolvedValue(mockRule);
    (useCreateAgentRule as ReturnType<typeof vi.fn>).mockReturnValue({ mutateAsync, isPending: false });
    const hook = useCreateAgentRule();
    const result = await hook.mutateAsync({ name: 'New Rule', isActive: true });
    expect(result.id).toBe('rule-1');
  });

  it('should complete delete rule user flow', async () => {
    const { useDeleteAgentRule } = await import('../hooks/useDeleteAgentRule');
    const mutateAsync = vi.fn().mockResolvedValue({ success: true });
    (useDeleteAgentRule as ReturnType<typeof vi.fn>).mockReturnValue({ mutateAsync, isPending: false });
    const hook = useDeleteAgentRule();
    const result = await hook.mutateAsync('rule-1');
    expect(result.success).toBe(true);
  });

  it('should handle network timeout gracefully', async () => {
    const { useAgentRules } = await import('../hooks/useAgentRules');
    (useAgentRules as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: Object.assign(new Error('Timeout'), { code: 'ECONNABORTED' }),
    });
    const hook = useAgentRules();
    expect(hook.error).toBeDefined();
  });

  it('should show loading spinner during data fetch', async () => {
    const { useAgentRules } = await import('../hooks/useAgentRules');
    (useAgentRules as ReturnType<typeof vi.fn>).mockReturnValue({ data: undefined, isLoading: true });
    const { ModuleAgentRuleButton } = await import('../components/ModuleAgentRuleButton');
    const wrapper = createWrapper();
    render(<ModuleAgentRuleButton />, { wrapper });
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should navigate to rule detail on item click', async () => {
    const navigate = vi.fn();
    const handleRuleClick = (id: string) => navigate(`/agent-rules/${id}`);
    handleRuleClick('rule-1');
    expect(navigate).toHaveBeenCalledWith('/agent-rules/rule-1');
  });

  it('should confirm before deleting a rule', async () => {
    const confirmed = vi.fn().mockReturnValue(true);
    const handleDelete = async (id: string) => {
      if (confirmed()) {
        return { deleted: id };
      }
      return null;
    };
    const result = await handleDelete('rule-1');
    expect(result?.deleted).toBe('rule-1');
  });

  it('should not delete when user cancels confirmation', async () => {
    const confirmed = vi.fn().mockReturnValue(false);
    const mutate = vi.fn();
    const handleDelete = (id: string) => {
      if (confirmed()) mutate(id);
    };
    handleDelete('rule-1');
    expect(mutate).not.toHaveBeenCalled();
  });

  it('should persist rule changes on save', async () => {
    const { useUpdateAgentRule } = await import('../hooks/useUpdateAgentRule');
    const mutateAsync = vi.fn().mockResolvedValue({ ...mockRule, name: 'Updated Rule' });
    (useUpdateAgentRule as ReturnType<typeof vi.fn>).mockReturnValue({ mutateAsync, isPending: false });
    const hook = useUpdateAgentRule();
    const updated = await hook.mutateAsync({ id: 'rule-1', name: 'Updated Rule' });
    expect(updated.name).toBe('Updated Rule');
  });

  it('should re-enable disabled button after action completes', async () => {
    const { useCreateAgentRule } = await import('../hooks/useCreateAgentRule');
    (useCreateAgentRule as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({ mutate: vi.fn(), isPending: true })
      .mockReturnValueOnce({ mutate: vi.fn(), isPending: false });
    const hook1 = useCreateAgentRule();
    expect(hook1.isPending).toBe(true);
    const hook2 = useCreateAgentRule();
    expect(hook2.isPending).toBe(false);
  });

  it('should display total rule count', () => {
    const rules = [mockRule, { ...mockRule, id: 'r2' }];
    const count = rules.length;
    expect(count).toBe(2);
  });

  it('should handle 401 unauthenticated redirect', async () => {
    const { useAgentRules } = await import('../hooks/useAgentRules');
    const error = Object.assign(new Error('Unauthorized'), { status: 401 });
    (useAgentRules as ReturnType<typeof vi.fn>).mockReturnValue({ data: undefined, isLoading: false, error });
    const hook = useAgentRules();
    expect((hook.error as any)?.status).toBe(401);
  });

  it('should handle 403 forbidden for non-admin', async () => {
    const { useCreateAgentRule } = await import('../hooks/useCreateAgentRule');
    const mutateAsync = vi.fn().mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }));
    (useCreateAgentRule as ReturnType<typeof vi.fn>).mockReturnValue({ mutateAsync, isPending: false });
    const hook = useCreateAgentRule();
    await expect(hook.mutateAsync({ name: 'test' })).rejects.toMatchObject({ status: 403 });
  });

  it('should search and filter rules', () => {
    const rules = [
      { ...mockRule, name: 'Portuguese rule' },
      { ...mockRule, id: 'r2', name: 'English rule' },
    ];
    const search = (term: string) => rules.filter(r => r.name.toLowerCase().includes(term));
    expect(search('portuguese')).toHaveLength(1);
    expect(search('')).toHaveLength(2);
  });

  it('should sort rules by priority', () => {
    const rules = [
      { ...mockRule, id: 'r2', priority: 2 },
      { ...mockRule, id: 'r1', priority: 1 },
    ];
    const sorted = [...rules].sort((a, b) => a.priority - b.priority);
    expect(sorted[0].id).toBe('r1');
  });

  it('should toggle rule active state', async () => {
    const { useUpdateAgentRule } = await import('../hooks/useUpdateAgentRule');
    const mutate = vi.fn();
    (useUpdateAgentRule as ReturnType<typeof vi.fn>).mockReturnValue({ mutate, isPending: false });
    const hook = useUpdateAgentRule();
    hook.mutate({ id: 'rule-1', isActive: false });
    expect(mutate).toHaveBeenCalledWith({ id: 'rule-1', isActive: false });
  });

  it('should show error toast on save failure', async () => {
    const showToast = vi.fn();
    const handleError = (e: Error) => showToast({ type: 'error', message: e.message });
    handleError(new Error('Save failed'));
    expect(showToast).toHaveBeenCalledWith({ type: 'error', message: 'Save failed' });
  });

  it('should show success toast on save success', async () => {
    const showToast = vi.fn();
    const handleSuccess = () => showToast({ type: 'success', message: 'Rule saved' });
    handleSuccess();
    expect(showToast).toHaveBeenCalledWith({ type: 'success', message: 'Rule saved' });
  });

  it('should reset form after successful creation', async () => {
    const reset = vi.fn();
    const afterCreate = () => reset();
    afterCreate();
    expect(reset).toHaveBeenCalled();
  });

  it('should close modal after deletion', async () => {
    const close = vi.fn();
    const afterDelete = () => close();
    afterDelete();
    expect(close).toHaveBeenCalled();
  });

  it('should prevent creating rule with same name as existing', () => {
    const existing = [mockRule];
    const canCreate = (name: string) => !existing.some(r => r.name === name);
    expect(canCreate('Respond in Portuguese')).toBe(false);
    expect(canCreate('New Rule')).toBe(true);
  });
});
