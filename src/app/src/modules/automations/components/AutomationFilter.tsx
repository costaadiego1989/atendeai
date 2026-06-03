import { useState, useEffect, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { debounce } from 'lodash-es';

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

export interface AutomationFilterOption {
  value: string;
  label: string;
}

export interface AutomationFilterProps {
  onFilterChange: (filter: AutomationFilter) => void;
  currentFilter: AutomationFilter;
  availableTriggers: TriggerType[];
  availableTags: string[];
  totalCount?: number;
}

export function AutomationFilter({
  onFilterChange,
  currentFilter,
  availableTriggers,
  availableTags,
  totalCount
}: AutomationFilterProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Debounce filter changes
  const debouncedFilterChange = useCallback(
    debounce((filter: AutomationFilter) => {
      onFilterChange(filter);
    }, 300),
    [onFilterChange]
  );

  const updateFilter = useCallback((updates: Partial<AutomationFilter>) => {
    const newFilter = { ...currentFilter, ...updates };
    debouncedFilterChange(newFilter);
  }, [currentFilter, debouncedFilterChange]);

  const triggerOptions = availableTriggers.map(type => ({
    value: type,
    label: TRIGGER_LABELS[type]
  }));

  const tagOptions = availableTags.map(tag => ({
    value: tag,
    label: tag
  }));

  return (
    <div className="glass-card mb-4 p-4 space-y-4">
      {/* Quick search and status */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {totalCount && (
          <Badge variant="secondary">
            <span className="font-bold text-foreground">{totalCount}</span>
            <span className="font-normal text-muted-foreground">
              {totalCount === 1 ? 'resultado' : 'resultados'}
            </span>
          </Badge>
        )}
        
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, descrição, tags..."
            className="pl-9"
            value={currentFilter.search}
            onChange={(e) => updateFilter({ search: e.target.value })}
            aria-label="Buscar automações"
          />
        </div>

        <div className="flex gap-2">
          <Select
            value={currentFilter.status}
            onValueChange={(value: 'all' | 'active' | 'inactive') => 
              updateFilter({ status: value })
            }
          >
            <SelectTrigger className="w-[140px]">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="active">Ativas</SelectItem>
              <SelectItem value="inactive">Inativas</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="gap-1.5"
            aria-expanded={isExpanded}
            aria-controls="advanced-filters"
          >
            <Settings className="h-4 w-4" />
            {isExpanded ? 'Simples' : 'Avançado'}
          </Button>
        </div>
      </div>

      {/* Advanced filters (collapsible) */}
      {isExpanded && (
        <div 
          id="advanced-filters"
          className="space-y-4 pt-4 border-t border-border/60"
        >
          <div className="grid gap-4 md:grid-cols-2">
            {/* Trigger types multi-select */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Tipos de Gatilho</Label>
              <MultiSelectFilter
                value={currentFilter.triggerTypes}
                options={triggerOptions}
                onChange={(values) => updateFilter({ triggerTypes: values })}
                placeholder="Selecione os tipos de gatilho"
                allLabel="Todos os tipos"
              />
            </div>

            {/* Tags multi-select */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Tags</Label>
              <MultiSelectFilter
                value={currentFilter.tags}
                options={tagOptions}
                onChange={(values) => updateFilter({ tags: values })}
                placeholder="Selecione as tags"
                allLabel="Todas as tags"
              />
            </div>

            {/* Date range */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Período</Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex-1 justify-start text-left font-normal"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {currentFilter.dateRange.start ? 
                        format(currentFilter.dateRange.start, 'dd/MM/yyyy') : 
                        'Data inicial'
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={currentFilter.dateRange.start}
                      onSelect={(date) => updateFilter({ 
                        dateRange: { ...currentFilter.dateRange, start: date }
                      })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <span className="flex items-center text-muted-foreground">até</span>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex-1 justify-start text-left font-normal"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {currentFilter.dateRange.end ? 
                        format(currentFilter.dateRange.end, 'dd/MM/yyyy') : 
                        'Data final'
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={currentFilter.dateRange.end}
                      onSelect={(date) => updateFilter({ 
                        dateRange: { ...currentFilter.dateRange, end: date }
                      })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Clear filters */}
            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onFilterChange({
                    search: '',
                    triggerTypes: [],
                    status: 'all',
                    dateRange: { start: null, end: null },
                    tags: []
                  });
                }}
                className="w-full"
              >
                Limpar filtros
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}