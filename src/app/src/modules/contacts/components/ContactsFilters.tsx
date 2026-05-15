import { Filter, Search } from 'lucide-react';
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
}

export function ContactsFilters({
  search,
  onSearchChange,
  stageFilter,
  onStageFilterChange,
  stageOptions,
  totalCount,
}: ContactsFiltersProps) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      {totalCount !== undefined && (
        <Badge variant="secondary" className="hidden lg:inline-flex items-center whitespace-nowrap h-9 px-3.5 rounded-md border-border/60 bg-muted/30">
          <span className="font-bold text-foreground mr-1.5">{totalCount}</span>
          <span className="font-normal text-muted-foreground">{totalCount === 1 ? 'resultado' : 'resultados'}</span>
        </Badge>
      )}

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
  );
}
