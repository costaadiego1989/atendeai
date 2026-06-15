import { Filter, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface StageOption {
  value: string;
  label: string;
}

interface ContactsFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  stageFilter: string;
  onStageFilterChange: (value: string) => void;
  stageOptions: StageOption[];
  totalCount?: number;
  periodFilter?: string;
  periodOptions?: Array<{ value: string; label: string }>;
  onPeriodFilterChange?: (value: string) => void;
  onClearFilters?: () => void;
  hasActiveFilters?: boolean;
}

export function ContactsFilters({
  search,
  onSearchChange,
  stageFilter,
  onStageFilterChange,
  stageOptions,
  totalCount,
  periodFilter,
  periodOptions,
  onPeriodFilterChange,
  onClearFilters,
  hasActiveFilters,
}: ContactsFiltersProps) {
  return (
    <div className="space-y-4">
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          <Badge 
            variant="secondary" 
            className="cursor-pointer hover:bg-muted"
            onClick={onClearFilters}
          >
            <X className="mr-1 h-3 w-3" />
            Limpar filtros
          </Badge>
          {search && (
            <Badge variant="secondary" className="cursor-pointer hover:bg-muted">
              Busca: {search}
              <X 
                className="ml-1 h-3 w-3 cursor-pointer hover:text-destructive" 
                onClick={() => onSearchChange('')}
              />
            </Badge>
          )}
          {stageFilter !== 'ALL' && (
            <Badge variant="secondary" className="cursor-pointer hover:bg-muted">
              Estágio: {stageOptions.find(opt => opt.value === stageFilter)?.label}
              <X 
                className="ml-1 h-3 w-3 cursor-pointer hover:text-destructive" 
                onClick={() => onStageFilterChange('ALL')}
              />
            </Badge>
          )}
        </div>
      )}
      
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {totalCount !== undefined && (
          <Badge variant="secondary" className="hidden lg:inline-flex items-center whitespace-nowrap h-9 px-3.5 rounded-md border-border/60 bg-muted/30">
            <span className="font-bold text-foreground mr-1.5">{totalCount}</span>
            <span className="font-normal text-muted-foreground">{totalCount === 1 ? 'resultado' : 'resultados'}</span>
          </Badge>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {periodOptions && onPeriodFilterChange && (
            <div className="grid grid-cols-3 rounded-xl border border-border/60 bg-background/60 p-1">
              {periodOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  variant={periodFilter === option.value ? 'default' : 'ghost'}
                  className="h-9 rounded-lg px-3 text-xs font-bold"
                  onClick={() => onPeriodFilterChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
          
          <button
            type="button"
            variant="outline"
            className="h-11 gap-2 rounded-xl px-4"
            onClick={() => {/* TODO: Open reports sheet */}}
          >
            <Filter className="h-4 w-4" />
            Relatórios
          </button>
        </div>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone, email ou tag..."
            className="pl-9"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>

        <Select value={stageFilter} onValueChange={onStageFilterChange}>
          <SelectTrigger className="w-full lg:w-[220px]">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            {stageOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
