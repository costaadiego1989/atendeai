import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { useVoiceSettingsViewModel } from '../view-models/useVoiceSettingsViewModel';

const mockGetConfig = vi.fn();
const mockUpdateConfig = vi.fn();
const mockListCalls = vi.fn();
const mockGetMetrics = vi.fn();

vi.mock('../services/voice-service', () => ({
  voiceService: {
    getConfig: (...args: unknown[]) => mockGetConfig(...args),
    updateConfig: (...args: unknown[]) => mockUpdateConfig(...args),
    listCalls: (...args: unknown[]) => mockListCalls(...args),
    getMetrics: (...args: unknown[]) => mockGetMetrics(...args),
    initiateCall: vi.fn(),
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
  enabled: true,
  persona: { name: 'Ana', tone: 'professional', speed: 1.0, language: 'pt-BR' },
  allowedHours: { start: '08:00', end: '20:00' },
  recovery: { enabled: true, daysAfterDue: 7, minAmount: 50, maxAttempts: 3, intervalHours: 48 },
  scripts: [{ name: 'Cobrança', type: 'recovery', template: 'Olá {nome}...' }],
};

const sampleMetrics = {
  totalCalls: 150,
  answeredRate: 72,
  agreementRate: 45,
  totalRecovered: 12500,
  avgDuration: 95,
};

describe('useVoiceSettingsViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockResolvedValue(sampleConfig);
    mockGetMetrics.mockResolvedValue(sampleMetrics);
    mockListCalls.mockResolvedValue({ items: [], total: 0, page: 1 });
  });

  it('should load config and metrics on mount', async () => {
    const { result } = renderHook(() => useVoiceSettingsViewModel(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetConfig).toHaveBeenCalledWith('tenant-123');
    expect(mockGetMetrics).toHaveBeenCalledWith('tenant-123', '30d');
    expect(result.current.config).toEqual(sampleConfig);
    expect(result.current.metrics?.totalCalls).toBe(150);
  });

  it('should save config and show toast', async () => {
    const updated = { ...sampleConfig, enabled: false };
    mockUpdateConfig.mockResolvedValue(updated);

    const { result } = renderHook(() => useVoiceSettingsViewModel(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.saveConfig({ enabled: false });
    });

    expect(mockUpdateConfig).toHaveBeenCalledWith('tenant-123', { enabled: false });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('salv') }),
    );
  });

  it('should change metrics period', async () => {
    const { result } = renderHook(() => useVoiceSettingsViewModel(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setMetricsPeriod('7d');
    });

    expect(result.current.metricsPeriod).toBe('7d');
  });
});
