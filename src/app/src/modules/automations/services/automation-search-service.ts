import { useState, useEffect, useCallback } from 'react';
import { debounce } from 'lodash-es';

export interface Automation {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  trigger: TriggerConfig;
  conditions: Record<string, unknown>[];
  steps: AutomationStep[];
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

export interface AutomationFilter {
  search: string;
  triggerTypes: TriggerType[];
  status: 'all' | 'active' | 'inactive';
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  tags: string[];
}

export interface AutomationMetrics {
  total: number;
  active: number;
  inactive: number;
  averageCreationTime: number;
  successRate: number;
  mostUsedTriggerType: TriggerType;
  mostUsedStepType: StepType;
}

export interface AutomationSearchService {
  searchAutomations: (filter: AutomationFilter) => Promise<Automation[]>;
  getMetrics: () => Promise<AutomationMetrics>;
  getAvailableTags: () => Promise<string[]>;
}

class AutomationSearchServiceImpl implements AutomationSearchService {
  private debounceTimer: NodeJS.Timeout | null = null;

  async searchAutomations(filter: AutomationFilter): Promise<Automation[]> {
    // Limpar timer anterior
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Simular debounce
    return new Promise((resolve) => {
      this.debounceTimer = setTimeout(async () => {
        try {
          const response = await fetch('/api/automations/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(filter),
          });

          if (!response.ok) {
            throw new Error('Failed to search automations');
          }

          const data = await response.json();
          resolve(data.automations || []);
        } catch (error) {
          console.error('Search error:', error);
          resolve([]);
        }
      }, 300);
    });
  }

  async getMetrics(): Promise<AutomationMetrics> {
    try {
      const response = await fetch('/api/automations/metrics');
      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }
      return await response.json();
    } catch (error) {
      console.error('Metrics error:', error);
      return {
        total: 0,
        active: 0,
        inactive: 0,
        averageCreationTime: 0,
        successRate: 0,
        mostUsedTriggerType: TriggerType.MESSAGE_RECEIVED,
        mostUsedStepType: StepType.SEND_MESSAGE,
      };
    }
  }

  async getAvailableTags(): Promise<string[]> {
    try {
      const response = await fetch('/api/automations/tags');
      if (!response.ok) {
        throw new Error('Failed to fetch tags');
      }
      return await response.json();
    } catch (error) {
      console.error('Tags error:', error);
      return [];
    }
  }
}

// Função utilitária para filtrar automações localmente (fallback)
export function filterAutomationsLocally(
  automations: Automation[],
  filter: AutomationFilter
): Automation[] {
  return automations.filter((automation) => {
    // Filtro de busca
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      const searchableText = `${automation.name} ${automation.description || ''} ${automation.tags?.join(' ') || ''}`.toLowerCase();
      if (!searchableText.includes(searchLower)) {
        return false;
      }
    }

    // Filtro de status
    if (filter.status !== 'all') {
      const isActive = filter.status === 'active';
      if (automation.isActive !== isActive) {
        return false;
      }
    }

    // Filtro de tipo de gatilho
    if (filter.triggerTypes.length > 0) {
      if (!filter.triggerTypes.includes(automation.trigger.type)) {
        return false;
      }
    }

    // Filtro de tags
    if (filter.tags.length > 0) {
      if (!filter.tags.some(tag => automation.tags?.includes(tag))) {
        return false;
      }
    }

    // Filtro de data range
    if (filter.dateRange.start || filter.dateRange.end) {
      const createdDate = new Date(automation.createdAt);
      
      if (filter.dateRange.start && createdDate < filter.dateRange.start) {
        return false;
      }
      
      if (filter.dateRange.end && createdDate > filter.dateRange.end) {
        return false;
      }
    }

    return true;
  });
}

// Hook para gerenciar estado de busca e filtros
export function useAutomationSearch(initialAutomations: Automation[] = []) {
  const [searchService] = useState(() => new AutomationSearchServiceImpl());
  const [automations, setAutomations] = useState<Automation[]>(initialAutomations);
  const [filteredAutomations, setFilteredAutomations] = useState<Automation[]>(initialAutomations);
  const [metrics, setMetrics] = useState<AutomationMetrics | null>(null);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentFilter, setCurrentFilter] = useState<AutomationFilter>({
    search: '',
    triggerTypes: [],
    status: 'all',
    dateRange: { start: null, end: null },
    tags: [],
  });

  // Aplicar filtros quando automações ou filtro mudam
  useEffect(() => {
    const filtered = filterAutomationsLocally(automations, currentFilter);
    setFilteredAutomations(filtered);
  }, [automations, currentFilter]);

  // Carregar métricas
  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const metricsData = await searchService.getMetrics();
        setMetrics(metricsData);
      } catch (error) {
        console.error('Failed to load metrics:', error);
      }
    };

    loadMetrics();
  }, [searchService]);

  // Carregar tags disponíveis
  useEffect(() => {
    const loadTags = async () => {
      try {
        const tags = await searchService.getAvailableTags();
        setAvailableTags(tags);
      } catch (error) {
        console.error('Failed to load tags:', error);
      }
    };

    loadTags();
  }, [searchService]);

  // Buscar automações com filtro
  const searchAutomations = useCallback(
    debounce(async (filter: AutomationFilter) => {
      setIsLoading(true);
      try {
        const results = await searchService.searchAutomations(filter);
        setAutomations(results);
      } catch (error) {
        console.error('Search failed:', error);
        // Fallback para busca local
        const filtered = filterAutomationsLocally(automations, filter);
        setAutomations(filtered);
      } finally {
        setIsLoading(false);
      }
    }, 500),
    [searchService, automations]
  );

  // Atualizar filtro
  const updateFilter = useCallback((filter: Partial<AutomationFilter>) => {
    const newFilter = { ...currentFilter, ...filter };
    setCurrentFilter(newFilter);
    searchAutomations(newFilter);
  }, [currentFilter, searchAutomations]);

  // Limpar filtros
  const clearFilters = useCallback(() => {
    const defaultFilter: AutomationFilter = {
      search: '',
      triggerTypes: [],
      status: 'all',
      dateRange: { start: null, end: null },
      tags: [],
    };
    setCurrentFilter(defaultFilter);
    searchAutomations(defaultFilter);
  }, [searchAutomations]);

  // Recarregar dados
  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const results = await searchService.searchAutomations(currentFilter);
      setAutomations(results);
    } catch (error) {
      console.error('Refetch failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [searchService, currentFilter]);

  return {
    automations,
    filteredAutomations,
    metrics,
    availableTags,
    isLoading,
    currentFilter,
    updateFilter,
    clearFilters,
    refetch,
    totalCount: filteredAutomations.length,
  };
}