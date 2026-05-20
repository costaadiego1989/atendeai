import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { useAutomationsViewModel } from '../view-models/useAutomationsViewModel';
import type { Automation } from '../types';
import { TriggerType, StepType } from '../types';

const mockList = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();
const mockActivate = vi.fn();
const mockDeactivate = vi.fn();

vi.mock('../services/automation-service', () => ({
  automationService: {
    list: (...args: unknown[]) => mockList(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    remove: (...args: unknown[]) => mockRemove(...args),
    activate: (...args: unknown[]) => mockActivate(...args),
    deactivate: (...args: unknown[]) => mockDeactivate(...args),
  },
}));

const mockAuthState = {
  user: null,
  tenant: { id: 'tenant-123' },
  activeBranchId: null,
  isAuthenticated: true,
  isLoading: false,
};

vi.mock('@/shared/stores/auth-store', () => ({
  useAuthStore: (selector?: (state: typeof mockAuthState) => unknown) =>
    selector ? selector(mockAuthState) : mockAuthState,
}));

const mockToast = vi.fn();
vi.mock('@/components/ui/use-toast', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

const sampleAutomation: Automation = {
  id: 'auto-1',
  tenantId: 'tenant-123',
  name: 'Boas-vindas',
  description: 'Envia mensagem ao criar contato',
  isActive: true,
  trigger: { type: TriggerType.CONTACT_CREATED, config: {} },
  conditions: [],
  steps: [{ id: 'step-1', type: StepType.SEND_MESSAGE, config: { body: 'Olá!' }, order: 0 }],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('useAutomationsViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue([sampleAutomation]);
  });

  it('should load automations on mount', async () => {
    const { result } = renderHook(() => useAutomationsViewModel(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockList).toHaveBeenCalledWith('tenant-123');
    expect(result.current.automations).toHaveLength(1);
    expect(result.current.automations[0].name).toBe('Boas-vindas');
  });

  it('should create automation and refresh list', async () => {
    const newAuto = { ...sampleAutomation, id: 'auto-2', name: 'Nova' };
    mockCreate.mockResolvedValue(newAuto);
    mockList.mockResolvedValueOnce([sampleAutomation]).mockResolvedValueOnce([sampleAutomation, newAuto]);

    const { result } = renderHook(() => useAutomationsViewModel(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.createAutomation({
        name: 'Nova',
        trigger: { type: TriggerType.CONTACT_CREATED, config: {} },
        steps: [{ type: StepType.SEND_MESSAGE, config: { body: 'Oi' }, order: 0 }],
      });
    });

    expect(mockCreate).toHaveBeenCalledWith('tenant-123', expect.objectContaining({ name: 'Nova' }));
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining('criada') }));
  });

  it('should toggle automation active state', async () => {
    mockDeactivate.mockResolvedValue({ ...sampleAutomation, isActive: false });

    const { result } = renderHook(() => useAutomationsViewModel(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.toggleActive('auto-1', true);
    });

    expect(mockDeactivate).toHaveBeenCalledWith('tenant-123', 'auto-1');
  });

  it('should activate when currently inactive', async () => {
    mockActivate.mockResolvedValue({ ...sampleAutomation, isActive: true });

    const { result } = renderHook(() => useAutomationsViewModel(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.toggleActive('auto-1', false);
    });

    expect(mockActivate).toHaveBeenCalledWith('tenant-123', 'auto-1');
  });

  it('should delete automation', async () => {
    mockRemove.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAutomationsViewModel(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.deleteAutomation('auto-1');
    });

    expect(mockRemove).toHaveBeenCalledWith('tenant-123', 'auto-1');
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining('excluída') }));
  });

  it('should filter automations by search term', async () => {
    const autos = [
      sampleAutomation,
      { ...sampleAutomation, id: 'auto-2', name: 'Recovery overdue' },
    ];
    mockList.mockResolvedValue(autos);

    const { result } = renderHook(() => useAutomationsViewModel(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setSearch('recovery');
    });

    expect(result.current.filteredAutomations).toHaveLength(1);
    expect(result.current.filteredAutomations[0].name).toBe('Recovery overdue');
  });
});
