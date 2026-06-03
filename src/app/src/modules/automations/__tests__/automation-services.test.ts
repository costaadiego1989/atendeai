import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAutomationSearch } from '../services/automation-search-service';
import { renderHook, act } from '@testing-library/react';
import { Automation } from '../types';

// Mock API client
vi.mock('@/shared/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockAutomations: Automation[] = [
  {
    id: 'automation-1',
    tenantId: 'tenant-1',
    name: 'Boas-vindas Automática',
    description: 'Envia mensagens de boas-vindas para novos contatos',
    isActive: true,
    trigger: {
      type: 'CONTACT_CREATED',
      config: {},
    },
    conditions: [],
    steps: [
      {
        id: 'step-1',
        type: 'SEND_MESSAGE',
        config: { channel: 'whatsapp', body: 'Olá! Seja bem-vindo(a)!' },
        order: 0,
      },
    ],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'automation-2',
    tenantId: 'tenant-1',
    name: 'Lembrete de Pagamento',
    description: 'Envia lembretes quando pagamentos estão vencidos',
    isActive: false,
    trigger: {
      type: 'PAYMENT_OVERDUE',
      config: {},
    },
    conditions: [],
    steps: [
      {
        id: 'step-1',
        type: 'SEND_MESSAGE',
        config: { channel: 'whatsapp', body: 'Seu pagamento está vencido.' },
        order: 0,
      },
    ],
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
];

describe('useAutomationSearch Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with empty automations and default filter', () => {
    const { result } = renderHook(() => useAutomationSearch([]));

    expect(result.current.automations).toEqual([]);
    expect(result.current.filteredAutomations).toEqual([]);
    expect(result.current.currentFilter).toEqual({
      search: '',
      triggerTypes: [],
      status: 'all',
      dateRange: { start: null, end: null },
      tags: [],
    });
    expect(result.current.isLoading).toBe(false);
  });

  it('filters automations by search term', () => {
    const { result } = renderHook(() => useAutomationSearch(mockAutomations));

    act(() => {
      result.current.updateFilter({ search: 'Boas-vindas' });
    });

    expect(result.current.filteredAutomations).toHaveLength(1);
    expect(result.current.filteredAutomations[0].name).toBe('Boas-vindas Automática');
  });

  it('filters automations by status', () => {
    const { result } = renderHook(() => useAutomationSearch(mockAutomations));

    act(() => {
      result.current.updateFilter({ status: 'active' });
    });

    expect(result.current.filteredAutomations).toHaveLength(1);
    expect(result.current.filteredAutomations[0].isActive).toBe(true);
  });

  it('filters automations by trigger type', () => {
    const { result } = renderHook(() => useAutomationSearch(mockAutomations));

    act(() => {
      result.current.updateFilter({ triggerTypes: ['CONTACT_CREATED'] });
    });

    expect(result.current.filteredAutomations).toHaveLength(1);
    expect(result.current.filteredAutomations[0].trigger.type).toBe('CONTACT_CREATED');
  });

  it('filters automations by date range', () => {
    const { result } = renderHook(() => useAutomationSearch(mockAutomations));

    const startDate = new Date('2024-01-01T00:00:00Z');
    const endDate = new Date('2024-01-01T23:59:59Z');

    act(() => {
      result.current.updateFilter({
        dateRange: { start: startDate, end: endDate },
      });
    });

    expect(result.current.filteredAutomations).toHaveLength(1);
    expect(result.current.filteredAutomations[0].createdAt).toBe('2024-01-01T00:00:00Z');
  });

  it('combines multiple filters', () => {
    const { result } = renderHook(() => useAutomationSearch(mockAutomations));

    act(() => {
      result.current.updateFilter({
        search: 'Boas-vindas',
        status: 'active',
        triggerTypes: ['CONTACT_CREATED'],
      });
    });

    expect(result.current.filteredAutomations).toHaveLength(1);
    expect(result.current.filteredAutomations[0].name).toBe('Boas-vindas Automática');
  });

  it('clears all filters', () => {
    const { result } = renderHook(() => useAutomationSearch(mockAutomations));

    // Apply some filters
    act(() => {
      result.current.updateFilter({ search: 'Boas-vindas', status: 'active' });
    });

    // Clear filters
    act(() => {
      result.current.clearFilters();
    });

    expect(result.current.currentFilter).toEqual({
      search: '',
      triggerTypes: [],
      status: 'all',
      dateRange: { start: null, end: null },
      tags: [],
    });
    expect(result.current.filteredAutomations).toHaveLength(mockAutomations.length);
  });

  it('handles empty results', () => {
    const { result } = renderHook(() => useAutomationSearch(mockAutomations));

    act(() => {
      result.current.updateFilter({ search: 'Nonexistent Automation' });
    });

    expect(result.current.filteredAutomations).toHaveLength(0);
    expect(result.current.totalCount).toBe(0);
  });

  it('loads metrics on mount', async () => {
    const { result } = renderHook(() => useAutomationSearch(mockAutomations));

    // Wait for effects to run
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.metrics).toBeDefined();
  });

  it('loads available tags on mount', async () => {
    const { result } = renderHook(() => useAutomationSearch(mockAutomations));

    // Wait for effects to run
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.availableTags).toBeDefined();
  });

  it('refetches data when refetch is called', async () => {
    const { result } = renderHook(() => useAutomationSearch(mockAutomations));

    act(() => {
      result.current.refetch();
    });

    // Should show loading state
    expect(result.current.isLoading).toBe(true);
  });
});

describe('filterAutomationsLocally function', () => {
  it('filters by search term', () => {
    const { filterAutomationsLocally } = require('../services/automation-search-service');
    
    const result = filterAutomationsLocally(mockAutomations, {
      search: 'Boas-vindas',
      triggerTypes: [],
      status: 'all',
      dateRange: { start: null, end: null },
      tags: [],
    });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Boas-vindas Automática');
  });

  it('filters by status', () => {
    const { filterAutomationsLocally } = require('../services/automation-search-service');
    
    const result = filterAutomationsLocally(mockAutomations, {
      search: '',
      triggerTypes: [],
      status: 'active',
      dateRange: { start: null, end: null },
      tags: [],
    });

    expect(result).toHaveLength(1);
    expect(result[0].isActive).toBe(true);
  });

  it('filters by trigger type', () => {
    const { filterAutomationsLocally } = require('../services/automation-search-service');
    
    const result = filterAutomationsLocally(mockAutomations, {
      search: '',
      triggerTypes: ['CONTACT_CREATED'],
      status: 'all',
      dateRange: { start: null, end: null },
      tags: [],
    });

    expect(result).toHaveLength(1);
    expect(result[0].trigger.type).toBe('CONTACT_CREATED');
  });

  it('filters by date range', () => {
    const { filterAutomationsLocally } = require('../services/automation-search-service');
    
    const startDate = new Date('2024-01-01T00:00:00Z');
    const endDate = new Date('2024-01-01T23:59:59Z');

    const result = filterAutomationsLocally(mockAutomations, {
      search: '',
      triggerTypes: [],
      status: 'all',
      dateRange: { start: startDate, end: endDate },
      tags: [],
    });

    expect(result).toHaveLength(1);
    expect(result[0].createdAt).toBe('2024-01-01T00:00:00Z');
  });

  it('returns all automations when no filters applied', () => {
    const { filterAutomationsLocally } = require('../services/automation-search-service');
    
    const result = filterAutomationsLocally(mockAutomations, {
      search: '',
      triggerTypes: [],
      status: 'all',
      dateRange: { start: null, end: null },
      tags: [],
    });

    expect(result).toHaveLength(mockAutomations.length);
  });

  it('handles empty automation list', () => {
    const { filterAutomationsLocally } = require('../services/automation-search-service');
    
    const result = filterAutomationsLocally([], {
      search: 'test',
      triggerTypes: [],
      status: 'all',
      dateRange: { start: null, end: null },
      tags: [],
    });

    expect(result).toHaveLength(0);
  });
});

describe('AutomationSearchService class', () => {
  let service: any;

  beforeEach(() => {
    const { AutomationSearchServiceImpl } = require('../services/automation-search-service');
    service = new AutomationSearchServiceImpl();
  });

  it('searches automations with debounce', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => ({ automations: mockAutomations }),
    });

    global.fetch = mockFetch;

    await service.searchAutomations({
      search: 'test',
      triggerTypes: [],
      status: 'all',
      dateRange: { start: null, end: null },
      tags: [],
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/automations/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        search: 'test',
        triggerTypes: [],
        status: 'all',
        dateRange: { start: null, end: null },
        tags: [],
      }),
    });
  });

  it('handles search errors gracefully', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('API Error'));
    global.fetch = mockFetch;

    const result = await service.searchAutomations({
      search: 'test',
      triggerTypes: [],
      status: 'all',
      dateRange: { start: null, end: null },
      tags: [],
    });

    expect(result).toEqual([]);
  });

  it('gets metrics successfully', async () => {
    const mockMetrics = {
      total: 10,
      active: 8,
      inactive: 2,
      averageCreationTime: 15.5,
      successRate: 95.2,
      mostUsedTriggerType: 'CONTACT_CREATED',
      mostUsedStepType: 'SEND_MESSAGE',
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => mockMetrics,
    });

    global.fetch = mockFetch;

    const result = await service.getMetrics();

    expect(result).toEqual(mockMetrics);
  });

  it('handles metrics errors gracefully', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('API Error'));
    global.fetch = mockFetch;

    const result = await service.getMetrics();

    expect(result).toEqual({
      total: 0,
      active: 0,
      inactive: 0,
      averageCreationTime: 0,
      successRate: 0,
      mostUsedTriggerType: 'CONTACT_CREATED',
      mostUsedStepType: 'SEND_MESSAGE',
    });
  });

  it('gets available tags successfully', async () => {
    const mockTags = ['tag1', 'tag2', 'tag3'];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => mockTags,
    });

    global.fetch = mockFetch;

    const result = await service.getAvailableTags();

    expect(result).toEqual(mockTags);
  });

  it('handles tags errors gracefully', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('API Error'));
    global.fetch = mockFetch;

    const result = await service.getAvailableTags();

    expect(result).toEqual([]);
  });
});