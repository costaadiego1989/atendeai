import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { useWidgetSettingsViewModel } from '../view-models/useWidgetSettingsViewModel';

const mockGetConfig = vi.fn();
const mockUpdateConfig = vi.fn();

vi.mock('../services/widget-service', () => ({
  widgetService: {
    getConfig: (...args: unknown[]) => mockGetConfig(...args),
    updateConfig: (...args: unknown[]) => mockUpdateConfig(...args),
  },
}));

const mockAuthState = {
  tenant: { id: 'tenant-123' },
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

const sampleConfig = {
  id: 'wc-1',
  tenantId: 'tenant-123',
  publicToken: 'abc-def-123',
  name: 'Meu Widget',
  enabled: true,
  greeting: 'Olá! Como posso ajudar?',
  color: '#3b82f6',
  position: 'bottom-right' as const,
  avatarUrl: null,
  collectName: true,
  collectPhone: false,
  proactiveDelay: 5000,
  proactiveMsg: 'Precisa de ajuda?',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('useWidgetSettingsViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockResolvedValue(sampleConfig);
  });

  it('should load widget config on mount', async () => {
    const { result } = renderHook(() => useWidgetSettingsViewModel(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGetConfig).toHaveBeenCalledWith('tenant-123');
    expect(result.current.config).toEqual(sampleConfig);
  });

  it('should save config and show toast', async () => {
    const updated = { ...sampleConfig, name: 'Widget Novo' };
    mockUpdateConfig.mockResolvedValue(updated);

    const { result } = renderHook(() => useWidgetSettingsViewModel(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.saveConfig({ name: 'Widget Novo' });
    });

    expect(mockUpdateConfig).toHaveBeenCalledWith('tenant-123', { name: 'Widget Novo' });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('salv') }),
    );
  });

  it('should generate embed snippet from publicToken', async () => {
    const { result } = renderHook(() => useWidgetSettingsViewModel(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.embedSnippet).toContain('abc-def-123');
    expect(result.current.embedSnippet).toContain('<script');
  });
});
