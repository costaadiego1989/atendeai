import { Package, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AppPagination } from '@/shared/ui/AppPagination';
import { EmptyState } from '@/shared/ui/EmptyState';
import { CatalogItemsTable } from './CatalogItemsTable';

interface CatalogItemsTabProps {
  items: any[];
  isLoading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  typeFilter: string;
  onTypeFilterChange: (value: any) => void;
  showInactive: boolean;
  onShowInactiveChange: (value: boolean) => void;
  onSelectItem: (item: any) => void;
  onNewItem: () => void;
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

export function CatalogItemsTab({
  items,
  isLoading,
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  showInactive,
  onShowInactiveChange,
  onSelectItem,
  onNewItem,
  page,
  totalPages,
  totalItems,
  onPageChange,
}: CatalogItemsTabProps) {
  return (
    <div className="space-y-4">
      <div className="bg-card border border-border/60 rounded-xl p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-3">
            <Badge variant="secondary" className="hidden lg:inline-flex items-center whitespace-nowrap h-9 px-3.5 rounded-md border-border/60 bg-muted/30">
              <span className="font-semibold text-foreground mr-1.5">{totalItems}</span>
              <span className="font-normal text-muted-foreground">{totalItems === 1 ? 'item' : 'itens'}</span>
            </Badge>
            <div className="relative flex-1 lg:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Buscar por nome, categoria ou referência..."
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Select value={typeFilter} onValueChange={onTypeFilterChange}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os tipos</SelectItem>
                <SelectItem value="SERVICE">Serviços</SelectItem>
                <SelectItem value="PRODUCT">Produtos</SelectItem>
                <SelectItem value="RENTAL">Locações</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant={showInactive ? 'default' : 'outline'} onClick={() => onShowInactiveChange(!showInactive)}>
              {showInactive ? 'Mostrando inativos' : 'Mostrar inativos'}
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border/40 bg-muted/20">
            <Skeleton className="h-4 w-40 rounded-md" />
          </div>
          <div className="divide-y divide-border/40">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-4 p-4">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3 rounded-md" />
                  <Skeleton className="h-3 w-1/2 rounded-md" />
                </div>
                <Skeleton className="h-6 w-20 rounded-md" />
                <Skeleton className="h-4 w-24 rounded-md" />
                <Skeleton className="h-4 w-20 rounded-md" />
                <Skeleton className="h-4 w-16 rounded-md" />
                <Skeleton className="h-6 w-16 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nenhum item encontrado"
          description="Crie o primeiro item real do catálogo para iniciar a operação."
          actionLabel="Novo item"
          onAction={onNewItem}
        />
      ) : (
        <div className="space-y-4">
          <CatalogItemsTable items={items} onSelectItem={onSelectItem} />
          <AppPagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            currentItemsCount={items.length}
            itemLabel="itens"
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}
